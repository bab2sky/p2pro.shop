use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Json, Router,
};
use bigdecimal::BigDecimal;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::domain::profit::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Seller profit & loss routes
pub fn seller_profit_router() -> Router<AppState> {
    Router::new()
        .route("/profit/summary", get(seller_profit_summary))
        .route("/profit/chart", get(seller_profit_chart))
        .route("/profit/statement", get(seller_pnl_statement))
        .route("/profit/products", get(seller_product_profit))
        .route("/profit/commissions", get(seller_commissions))
        .route("/profit/refunds", get(seller_refund_losses))
        .route("/profit/cashflow", get(seller_cashflow))
        .route("/profit/export", get(seller_profit_export))
}

fn default_range(params: &ProfitPeriodParams) -> (NaiveDate, NaiveDate) {
    let to = params.to.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let from = params
        .from
        .unwrap_or_else(|| to - chrono::Duration::days(30));
    (from, to)
}

fn previous_range(from: NaiveDate, to: NaiveDate) -> (NaiveDate, NaiveDate) {
    let duration = to.signed_duration_since(from).num_days();
    let prev_to = from - chrono::Duration::days(1);
    let prev_from = prev_to - chrono::Duration::days(duration - 1);
    (prev_from, prev_to)
}

fn pct_change(current: &BigDecimal, previous: &BigDecimal) -> BigDecimal {
    let zero = BigDecimal::from(0);
    if *previous == zero {
        if *current == zero {
            zero
        } else {
            BigDecimal::from(100)
        }
    } else {
        let diff = current - previous;
        &diff * BigDecimal::from(100) / previous
    }
}

fn calc_margin(net: &BigDecimal, gross: &BigDecimal) -> BigDecimal {
    let zero = BigDecimal::from(0);
    if *gross > zero {
        net * BigDecimal::from(100) / gross
    } else {
        zero
    }
}

fn pagination(params: &ProfitPeriodParams) -> (i64, i64, i64) {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;
    (page, per_page, offset)
}

/// 매출 인식 정책.
///
/// orders.status IN ('delivered', 'confirmed') — 배송완료 또는 구매확정 만 매출.
/// pending_payment, payment_verified, preparing, shipped 같은 진행 중 상태는
/// "회수가 아직 미확정" 이므로 매출/수수료/순이익 어느 카드에도 잡히지 않는다.
/// domain/settlement.rs 의 settlement summary 와 동일 정책 — 두 화면 합계가
/// 어긋나지 않게 보장.
///
/// 모든 profit 핸들러가 사용하는 공통 helper.
///
/// 버그 배경: orders.seller_id 는 seller_profiles(id) 를 참조하지만 auth.id 는
/// users(id) 다. 직접 비교하면 절대 매칭 안 되어 모든 합계가 0 으로 나옴
/// (https://p2pro.shop/seller/profit 전부 0 표시되던 원인). 공통 lookup 후
/// seller_profiles.id 로 변환해야 한다.
async fn resolve_seller_id(db: &sqlx::PgPool, user_id: Uuid) -> Result<Uuid, AppError> {
    crate::domain::settlement::get_seller_id_any_status(db, user_id)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to resolve seller: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))
}

// --- Handlers ---

/// GET /api/seller/profit/summary
async fn seller_profit_summary(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    // Current period
    let row = sqlx::query_as::<_, (BigDecimal, BigDecimal, BigDecimal, BigDecimal, i64)>(
        r#"SELECT COALESCE(SUM(total_amount), 0),
                  COALESCE(SUM(margin_amount), 0),
                  COALESCE(SUM(COALESCE(commission_amount, 0)), 0),
                  COALESCE(SUM(shipping_fee), 0),
                  COUNT(*)::bigint
           FROM orders
           WHERE seller_id = $1
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let (gross_sales, margin_income, total_commission, total_shipping, total_orders) = row;

    // Refund total
    let refund_total = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(COALESCE(r.refund_amount, 0)), 0)
           FROM refund_requests r
           JOIN orders o ON o.id = r.order_id
           WHERE o.seller_id = $1
             AND r.status = 'admin_completed'
             AND r.created_at::date BETWEEN $2 AND $3"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    // 순이익 = 마진수입 - 비용 (수수료 + 배송비 + 환불).
    //
    // 이전 버그: net_profit = gross_sales - total_costs.
    // total_amount 에는 base_price (셀러 원가) 가 이미 포함돼 있어
    // 마진 0% 물건도 양수의 "순이익" 으로 잡혔다. (사용자 보고:
    // "0% 마진 물건만 팔았는데 순이익 576.8 / 이익률 80%".)
    //
    // 회계상 셀러의 실현 이익 = (판매가 - 원가) - 플랫폼 비용 = margin - costs.
    // migrations/037 의 orders.net_profit = margin_amount - commission_amount
    // 와 동일 정책 (배송비/환불은 별도 비용 카테고리로 추가 차감).
    let total_costs = &total_commission + &total_shipping + &refund_total;
    let net_profit = &margin_income - &total_costs;
    let profit_margin = calc_margin(&net_profit, &gross_sales);

    // Previous period comparison
    let (prev_from, prev_to) = previous_range(from, to);
    let prev = sqlx::query_as::<_, (BigDecimal, BigDecimal)>(
        r#"SELECT COALESCE(SUM(total_amount), 0),
                  COALESCE(SUM(margin_amount) - SUM(COALESCE(commission_amount, 0)) - SUM(shipping_fee), 0)
           FROM orders
           WHERE seller_id = $1
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(prev_from)
    .bind(prev_to)
    .fetch_one(&state.db)
    .await?;

    let summary = SellerProfitSummary {
        gross_sales: gross_sales.clone(),
        total_orders,
        margin_income,
        total_commission: total_commission.clone(),
        total_shipping: total_shipping.clone(),
        net_profit: net_profit.clone(),
        profit_margin,
        cost_breakdown: CostBreakdown {
            commission: total_commission,
            shipping: total_shipping,
            refunds: refund_total,
            total_costs,
        },
        comparison: PeriodComparison {
            previous_net_profit: prev.1.clone(),
            previous_gross_sales: prev.0.clone(),
            profit_change_pct: pct_change(&net_profit, &prev.1),
            sales_change_pct: pct_change(&gross_sales, &prev.0),
        },
    };

    Ok(Json(serde_json::json!({ "data": summary })))
}

/// GET /api/seller/profit/chart
async fn seller_profit_chart(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    // 일별 (gross_sales, net_profit, orders).
    // net_profit = SUM(margin) - SUM(commission) - SUM(shipping). summary 와 동일 정책.
    let rows = sqlx::query_as::<_, (NaiveDate, BigDecimal, BigDecimal, i64)>(
        r#"SELECT created_at::date as dt,
                  COALESCE(SUM(total_amount), 0),
                  COALESCE(SUM(margin_amount) - SUM(COALESCE(commission_amount, 0)) - SUM(shipping_fee), 0),
                  COUNT(*)::bigint
           FROM orders
           WHERE seller_id = $1
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')
           GROUP BY dt
           ORDER BY dt"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let chart: Vec<ProfitChartPoint> = rows
        .into_iter()
        .map(|(date, gross_sales, net_profit, orders)| ProfitChartPoint {
            date,
            gross_sales,
            net_profit,
            orders,
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": chart })))
}

/// GET /api/seller/profit/statement
async fn seller_pnl_statement(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    // Revenue
    let rev = sqlx::query_as::<_, (BigDecimal,)>(
        r#"SELECT COALESCE(SUM(total_amount), 0)
           FROM orders
           WHERE seller_id = $1
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;
    let gross_sales = rev.0;

    // Refunds
    let refunds = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(COALESCE(r.refund_amount, 0)), 0)
           FROM refund_requests r
           JOIN orders o ON o.id = r.order_id
           WHERE o.seller_id = $1
             AND r.status = 'admin_completed'
             AND r.created_at::date BETWEEN $2 AND $3"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let net_revenue = &gross_sales - &refunds;

    // COGS: base_cost = SUM(oi.quantity * p.base_price), shipping
    let cogs = sqlx::query_as::<_, (BigDecimal, BigDecimal)>(
        r#"SELECT COALESCE(SUM(oi.quantity * p.base_price), 0),
                  COALESCE(SUM(o.shipping_fee), 0)
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           JOIN products p ON p.id = oi.product_id
           WHERE o.seller_id = $1
             AND o.created_at::date BETWEEN $2 AND $3
             AND o.status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let base_cost = cogs.0;
    let shipping_cost = cogs.1;
    let total_cogs = &base_cost + &shipping_cost;
    let gross_profit = &net_revenue - &total_cogs;

    // Operating expenses: commission + coupon discounts
    let commission = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(COALESCE(commission_amount, 0)), 0)
           FROM orders
           WHERE seller_id = $1
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let coupon_discounts = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(COALESCE(discount_amount, 0)), 0)
           FROM orders
           WHERE seller_id = $1
             AND coupon_id IS NOT NULL
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let total_opex = &commission + &coupon_discounts;
    let net_income = &gross_profit - &total_opex;
    let net_margin_pct = calc_margin(&net_income, &gross_sales);

    let statement = PnLStatement {
        period_start: from,
        period_end: to,
        revenue: RevenueSection {
            gross_sales,
            refunds,
            net_revenue,
        },
        cost_of_goods: CostOfGoodsSection {
            base_cost,
            shipping_cost,
            total_cogs,
        },
        gross_profit,
        operating_expenses: OperatingExpenses {
            commission,
            coupon_discounts,
            total_opex,
        },
        net_income: NetIncomeSection {
            net_income,
            net_margin_pct,
        },
    };

    Ok(Json(serde_json::json!({ "data": statement })))
}

/// GET /api/seller/profit/products
async fn seller_product_profit(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let (page, per_page, offset) = pagination(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    let total = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(DISTINCT oi.product_id)
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.seller_id = $1
             AND o.created_at::date BETWEEN $2 AND $3
             AND o.status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            BigDecimal,
            BigDecimal,
            i64,
            BigDecimal,
            BigDecimal,
        ),
    >(
        r#"SELECT oi.product_id,
                  p.title,
                  COALESCE(p.base_price, 0),
                  CASE WHEN SUM(oi.quantity) > 0
                       THEN SUM(oi.subtotal) / SUM(oi.quantity)
                       ELSE 0
                  END as avg_price,
                  SUM(oi.quantity)::bigint,
                  SUM(oi.subtotal) as revenue,
                  SUM(oi.quantity * p.base_price) as cost
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           WHERE o.seller_id = $1
             AND o.created_at::date BETWEEN $2 AND $3
             AND o.status IN ('delivered', 'confirmed')
           GROUP BY oi.product_id, p.title, p.base_price
           ORDER BY revenue DESC
           LIMIT $4 OFFSET $5"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let products: Vec<ProductProfit> = rows
        .into_iter()
        .map(
            |(product_id, title, base_price, avg_selling_price, units_sold, revenue, cost)| {
                let profit = &revenue - &cost;
                let margin_pct = calc_margin(&profit, &revenue);
                ProductProfit {
                    product_id,
                    title,
                    base_price,
                    avg_selling_price,
                    units_sold,
                    revenue,
                    cost,
                    profit,
                    margin_pct,
                }
            },
        )
        .collect();

    let total_pages = if per_page > 0 {
        (total + per_page - 1) / per_page
    } else {
        0
    };

    Ok(Json(serde_json::json!({
        "data": products,
        "pagination": PaginationMeta { page, per_page, total, total_pages }
    })))
}

/// GET /api/seller/profit/commissions
async fn seller_commissions(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let (page, per_page, offset) = pagination(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    let total = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*)
           FROM orders
           WHERE seller_id = $1
             AND commission_amount IS NOT NULL
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            BigDecimal,
            BigDecimal,
            BigDecimal,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"SELECT id, order_number, total_amount,
                  COALESCE(commission_rate, 0),
                  COALESCE(commission_amount, 0),
                  created_at
           FROM orders
           WHERE seller_id = $1
             AND commission_amount IS NOT NULL
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')
           ORDER BY created_at DESC
           LIMIT $4 OFFSET $5"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let commissions: Vec<CommissionDetail> = rows
        .into_iter()
        .map(
            |(
                order_id,
                order_number,
                order_total,
                commission_rate,
                commission_amount,
                created_at,
            )| {
                CommissionDetail {
                    order_id,
                    order_number,
                    order_total,
                    commission_rate,
                    commission_amount,
                    created_at,
                }
            },
        )
        .collect();

    let total_pages = if per_page > 0 {
        (total + per_page - 1) / per_page
    } else {
        0
    };

    Ok(Json(serde_json::json!({
        "data": commissions,
        "pagination": PaginationMeta { page, per_page, total, total_pages }
    })))
}

/// GET /api/seller/profit/refunds
async fn seller_refund_losses(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            BigDecimal,
            Option<String>,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"SELECT r.id, r.order_id, COALESCE(r.refund_amount, 0), r.reason, r.created_at
           FROM refund_requests r
           JOIN orders o ON o.id = r.order_id
           WHERE o.seller_id = $1
             AND r.status = 'admin_completed'
             AND r.created_at::date BETWEEN $2 AND $3
           ORDER BY r.created_at DESC"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let total_refunds = rows.len() as i64;
    let total_amount = rows.iter().fold(BigDecimal::from(0), |acc, r| &acc + &r.2);

    let items: Vec<RefundLossItem> = rows
        .into_iter()
        .map(
            |(refund_id, order_id, amount, reason, created_at)| RefundLossItem {
                refund_id,
                order_id,
                amount,
                reason,
                created_at,
            },
        )
        .collect();

    let summary = RefundSummary {
        total_refunds,
        total_amount,
        items,
    };

    Ok(Json(serde_json::json!({ "data": summary })))
}

/// GET /api/seller/profit/cashflow
async fn seller_cashflow(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    // 정책: cashflow 는 orders + withdrawal_requests 에서 직접 합산.
    //
    // 이전 구현은 settlements 테이블을 읽었지만 P2PRO 의 'sale' 타입 settlement
    // 자동 생성 로직이 없어서 (refund 만 INSERT) 실제 매출이 cashflow 에 영영
    // 잡히지 않았다. 사용자 보고: confirmed 주문이 있는데 캐시플로우 모든 카드가 0.
    //
    // domain/settlement.rs 의 SettlementSummary 와 동일한 직접계산 패턴을 사용해
    // settlement / profit 두 화면이 같은 셀러 화폐 흐름을 공유하도록 함.
    //
    // 인플로 (셀러 입금) = SUM(total_amount - commission_amount) 의 confirmed/delivered 주문.
    //   → 셀러가 buyer 결제 후 수수료 제외하고 받는 실제 금액.
    // 아웃플로 (셀러 출금) = SUM(amount) 의 completed withdrawal_requests.

    // Total earned = 누적 인플로
    let total_earned = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(total_amount - COALESCE(commission_amount, 0)), 0)
           FROM orders
           WHERE seller_id = $1
             AND status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    // Total withdrawn (완료된 출금 누적)
    let withdrawn_row = sqlx::query_as::<_, (BigDecimal, BigDecimal)>(
        r#"SELECT COALESCE(SUM(amount), 0),
                  COALESCE(SUM(fee_amount), 0)
           FROM withdrawal_requests
           WHERE seller_id = $1
             AND status = 'completed'"#,
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    // Pending withdrawals (출금 대기)
    let pending = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(amount), 0)
           FROM withdrawal_requests
           WHERE seller_id = $1
             AND status IN ('pending', 'approved')"#,
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    // Refunds (환불 차감)
    let total_refunded = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(total_amount - COALESCE(commission_amount, 0)), 0)
           FROM orders
           WHERE seller_id = $1
             AND status = 'refunded'"#,
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    // Available balance = total_earned - withdrawn - pending - refunds, 0 으로 클램핑.
    // settlement.rs::compute_settlement_summary 와 동일 공식.
    let balance = (&total_earned - &withdrawn_row.0 - &pending - &total_refunded)
        .max(BigDecimal::from(0));

    // Daily inflow chart — 일별 인플로 (confirmed/delivered 주문 기준)
    let inflow_rows = sqlx::query_as::<_, (NaiveDate, BigDecimal)>(
        r#"SELECT created_at::date as dt,
                  COALESCE(SUM(total_amount - COALESCE(commission_amount, 0)), 0)
           FROM orders
           WHERE seller_id = $1
             AND status IN ('delivered', 'confirmed')
             AND created_at::date BETWEEN $2 AND $3
           GROUP BY dt
           ORDER BY dt"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    // Daily outflow chart — 일별 아웃플로 (completed withdrawal 기준).
    // requested_at 사용: 사용자가 출금을 요청한 시점이 자금흐름 기준.
    let outflow_rows = sqlx::query_as::<_, (NaiveDate, BigDecimal)>(
        r#"SELECT requested_at::date as dt, COALESCE(SUM(amount), 0)
           FROM withdrawal_requests
           WHERE seller_id = $1
             AND status = 'completed'
             AND requested_at::date BETWEEN $2 AND $3
           GROUP BY dt
           ORDER BY dt"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    // Merge inflow/outflow into chart points
    let mut date_map: std::collections::BTreeMap<NaiveDate, (BigDecimal, BigDecimal)> =
        std::collections::BTreeMap::new();
    for (dt, amt) in &inflow_rows {
        date_map
            .entry(*dt)
            .or_insert_with(|| (BigDecimal::from(0), BigDecimal::from(0)))
            .0 = amt.clone();
    }
    for (dt, amt) in &outflow_rows {
        date_map
            .entry(*dt)
            .or_insert_with(|| (BigDecimal::from(0), BigDecimal::from(0)))
            .1 = amt.clone();
    }

    let mut running_balance = BigDecimal::from(0);
    let chart: Vec<CashflowPoint> = date_map
        .into_iter()
        .map(|(date, (inflow, outflow))| {
            running_balance = &running_balance + &inflow - &outflow;
            CashflowPoint {
                date,
                inflow,
                outflow,
                balance: running_balance.clone(),
            }
        })
        .collect();

    let summary = CashflowSummary {
        current_balance: balance,
        total_earned,
        total_withdrawn: withdrawn_row.0,
        total_fees: withdrawn_row.1,
        pending_settlements: pending,
        chart,
    };

    Ok(Json(serde_json::json!({ "data": summary })))
}

/// GET /api/seller/profit/export — XLSX download
async fn seller_profit_export(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<(axum::http::StatusCode, axum::http::HeaderMap, Vec<u8>), AppError> {
    use rust_xlsxwriter::*;

    let (from, to) = default_range(&params);
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    let rows = sqlx::query_as::<
        _,
        (
            String,
            BigDecimal,
            BigDecimal,
            BigDecimal,
            BigDecimal,
            String,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"SELECT order_number, total_amount, shipping_fee,
                  COALESCE(commission_amount, 0),
                  COALESCE(net_profit, 0),
                  status::text,
                  created_at
           FROM orders
           WHERE seller_id = $1
             AND created_at::date BETWEEN $2 AND $3
             AND status IN ('delivered', 'confirmed')
           ORDER BY created_at DESC"#,
    )
    .bind(seller_id)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let mut workbook = Workbook::new();
    let ws = workbook.add_worksheet();

    let headers = [
        "주문번호",
        "총액",
        "배송비",
        "수수료",
        "순이익",
        "상태",
        "주문일시",
    ];
    for (c, h) in headers.iter().enumerate() {
        let _ = ws.write_string(0, c as u16, *h);
    }

    for (r, row) in rows.iter().enumerate() {
        let r = (r + 1) as u32;
        let _ = ws.write_string(r, 0, &row.0);
        let _ = ws.write_string(r, 1, row.1.to_string());
        let _ = ws.write_string(r, 2, row.2.to_string());
        let _ = ws.write_string(r, 3, row.3.to_string());
        let _ = ws.write_string(r, 4, row.4.to_string());
        let _ = ws.write_string(r, 5, &row.5);
        let _ = ws.write_string(r, 6, row.6.to_rfc3339());
    }

    let buf = workbook
        .save_to_buffer()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?;

    let mut headers_map = axum::http::HeaderMap::new();
    headers_map.insert(
        axum::http::header::CONTENT_TYPE,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            .parse()
            .unwrap(),
    );
    headers_map.insert(
        axum::http::header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"profit_{}_{}.xlsx\"", from, to)
            .parse()
            .unwrap(),
    );

    Ok((axum::http::StatusCode::OK, headers_map, buf))
}

// NOTE: Add `pub mod profit;` to packages/backend/src/api/mod.rs
// Then wire it up: `.nest("/seller", profit::seller_profit_router())`
// in the `protected` section of api_router().
