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

/// Admin profit & loss routes (behind AdminGuard)
pub fn admin_profit_router() -> Router<AppState> {
    Router::new()
        .route("/profit/platform-summary", get(platform_summary))
        .route("/profit/platform-chart", get(platform_chart))
        .route("/profit/sellers", get(seller_contributions))
        .route("/profit/categories", get(category_profits))
        .route("/profit/platform-pnl", get(platform_pnl))
        .route("/profit/export", get(platform_profit_export))
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

fn pagination(params: &ProfitPeriodParams) -> (i64, i64, i64) {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;
    (page, per_page, offset)
}

// --- Handlers ---

/// GET /api/admin/profit/platform-summary
async fn platform_summary(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);

    // Current period GMV and commission — NET figures from immutable ledger.
    // Past-period totals no longer change when later refunds happen because each
    // event (confirm + refund) lives on its own row dated to when it occurred.
    let row = sqlx::query_as::<_, (BigDecimal, BigDecimal, i64)>(
        r#"SELECT COALESCE(SUM(order_amount), 0),
                  COALESCE(SUM(commission_amount), 0),
                  COUNT(*) FILTER (WHERE entry_type = 'confirmed_revenue')::bigint
           FROM order_commission_logs
           WHERE created_at::date BETWEEN $1 AND $2"#,
    )
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let (gmv, total_commission, total_orders) = row;

    // Withdrawal fees
    let withdrawal_fees = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(fee_amount), 0)
           FROM settlements
           WHERE type = 'withdrawal'
             AND status = 'completed'
             AND created_at::date BETWEEN $1 AND $2"#,
    )
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    // Total refunds
    let total_refunds = sqlx::query_scalar::<_, BigDecimal>(
        r#"SELECT COALESCE(SUM(COALESCE(refund_amount, 0)), 0)
           FROM refund_requests
           WHERE status = 'admin_completed'
             AND created_at::date BETWEEN $1 AND $2"#,
    )
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let platform_revenue = &total_commission + &withdrawal_fees;
    let net_platform_profit = &platform_revenue - &total_refunds;

    // Previous period comparison — same ledger-based calculation
    let (prev_from, prev_to) = previous_range(from, to);
    let prev = sqlx::query_as::<_, (BigDecimal, BigDecimal)>(
        r#"SELECT COALESCE(SUM(order_amount), 0),
                  COALESCE(SUM(commission_amount), 0)
           FROM order_commission_logs
           WHERE created_at::date BETWEEN $1 AND $2"#,
    )
    .bind(prev_from)
    .bind(prev_to)
    .fetch_one(&state.db)
    .await?;

    let summary = PlatformProfitSummary {
        gmv: gmv.clone(),
        total_orders,
        total_commission: total_commission.clone(),
        total_withdrawal_fees: withdrawal_fees,
        platform_revenue,
        total_refunds,
        net_platform_profit,
        comparison: PlatformComparison {
            previous_gmv: prev.0.clone(),
            previous_commission: prev.1.clone(),
            gmv_change_pct: pct_change(&gmv, &prev.0),
            commission_change_pct: pct_change(&total_commission, &prev.1),
        },
    };

    Ok(Json(serde_json::json!({ "data": summary })))
}

/// GET /api/admin/profit/platform-chart
async fn platform_chart(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);

    // Day-by-day chart from immutable ledger
    let rows = sqlx::query_as::<_, (NaiveDate, BigDecimal, BigDecimal, i64)>(
        r#"SELECT created_at::date as dt,
                  COALESCE(SUM(order_amount), 0),
                  COALESCE(SUM(commission_amount), 0),
                  COUNT(*) FILTER (WHERE entry_type = 'confirmed_revenue')::bigint
           FROM order_commission_logs
           WHERE created_at::date BETWEEN $1 AND $2
           GROUP BY dt
           ORDER BY dt"#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let chart: Vec<PlatformChartPoint> = rows
        .into_iter()
        .map(|(date, gmv, commission, orders)| PlatformChartPoint {
            date,
            gmv,
            commission,
            orders,
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": chart })))
}

/// GET /api/admin/profit/sellers
async fn seller_contributions(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);
    let (page, per_page, offset) = pagination(&params);

    // Per-seller contributions from immutable ledger.
    //
    // Round 6a (C3, migration 044): order_commission_logs.seller_id 가
    // seller_profiles(id) 를 참조하도록 표준화됐다. orders/refund_requests/
    // settlements 등과 동일한 키 체계라 cross-FK 변환 코드가 사라졌다.
    let total = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(DISTINCT seller_id)
           FROM order_commission_logs
           WHERE created_at::date BETWEEN $1 AND $2
             AND entry_type = 'confirmed_revenue'"#,
    )
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let rows = sqlx::query_as::<_, (Uuid, Option<String>, BigDecimal, i64, BigDecimal)>(
        r#"SELECT ocl.seller_id,
                  COALESCE(sp.business_name, u.username),
                  COALESCE(SUM(ocl.order_amount), 0) as gmv,
                  COUNT(*) FILTER (WHERE ocl.entry_type = 'confirmed_revenue')::bigint as order_count,
                  COALESCE(SUM(ocl.commission_amount), 0) as commission
           FROM order_commission_logs ocl
           LEFT JOIN seller_profiles sp ON sp.id = ocl.seller_id
           LEFT JOIN users u ON u.id = sp.user_id
           WHERE ocl.created_at::date BETWEEN $1 AND $2
           GROUP BY ocl.seller_id, sp.business_name, u.username
           ORDER BY gmv DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(from)
    .bind(to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    // 환불 합계 — seller 별 (seller_profile_id) 집계.
    // Round 6a 이후 ocl.seller_id == r.seller_id == seller_profiles(id) 로
    // 통일됐다. 별도 JOIN/정규화 불필요.
    let refund_rows = sqlx::query_as::<_, (Uuid, BigDecimal)>(
        r#"SELECT r.seller_id, COALESCE(SUM(COALESCE(r.refund_amount, 0)), 0)
           FROM refund_requests r
           WHERE r.status = 'admin_completed'
             AND r.created_at::date BETWEEN $1 AND $2
           GROUP BY r.seller_id"#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let refund_map: std::collections::HashMap<Uuid, BigDecimal> = refund_rows.into_iter().collect();

    let sellers: Vec<SellerContribution> = rows
        .into_iter()
        .map(|(seller_id, business_name, gmv, orders, commission)| {
            let refunds = refund_map
                .get(&seller_id)
                .cloned()
                .unwrap_or_else(|| BigDecimal::from(0));
            let net_contribution = &commission - &refunds;
            SellerContribution {
                seller_id,
                business_name,
                gmv,
                orders,
                commission,
                refunds,
                net_contribution,
            }
        })
        .collect();

    let total_pages = if per_page > 0 {
        (total + per_page - 1) / per_page
    } else {
        0
    };

    Ok(Json(serde_json::json!({
        "data": sellers,
        "pagination": PaginationMeta { page, per_page, total, total_pages }
    })))
}

/// GET /api/admin/profit/categories
async fn category_profits(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);

    let rows = sqlx::query_as::<_, (Uuid, String, BigDecimal, i64, BigDecimal, i64)>(
        r#"SELECT c.id,
                  c.name,
                  COALESCE(SUM(oi.subtotal), 0) as gmv,
                  COUNT(DISTINCT o.id)::bigint as order_count,
                  COALESCE(SUM(
                      COALESCE(o.commission_amount, 0) *
                      (oi.subtotal / NULLIF(o.subtotal, 0))
                  ), 0) as commission,
                  COALESCE(SUM(oi.quantity), 0)::bigint as units_sold
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           JOIN categories c ON c.id = p.category_id
           WHERE o.created_at::date BETWEEN $1 AND $2
             AND o.status IN ('delivered', 'confirmed')
           GROUP BY c.id, c.name
           ORDER BY gmv DESC"#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let categories: Vec<CategoryProfit> = rows
        .into_iter()
        .map(
            |(category_id, category_name, gmv, orders, commission, units_sold)| CategoryProfit {
                category_id,
                category_name,
                gmv,
                orders,
                commission,
                units_sold,
            },
        )
        .collect();

    Ok(Json(serde_json::json!({ "data": categories })))
}

/// GET /api/admin/profit/platform-pnl
async fn platform_pnl(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (from, to) = default_range(&params);

    // Monthly P&L from immutable ledger
    let rows = sqlx::query_as::<_, (String, BigDecimal, BigDecimal)>(
        r#"SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                  COALESCE(SUM(order_amount), 0) as gmv,
                  COALESCE(SUM(commission_amount), 0) as commission
           FROM order_commission_logs
           WHERE created_at::date BETWEEN $1 AND $2
           GROUP BY month
           ORDER BY month"#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    // Withdrawal fees by month
    let fee_rows = sqlx::query_as::<_, (String, BigDecimal)>(
        r#"SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                  COALESCE(SUM(fee_amount), 0)
           FROM settlements
           WHERE type = 'withdrawal'
             AND status = 'completed'
             AND created_at::date BETWEEN $1 AND $2
           GROUP BY month"#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let fee_map: std::collections::HashMap<String, BigDecimal> = fee_rows.into_iter().collect();

    // Refunds by month
    let refund_rows = sqlx::query_as::<_, (String, BigDecimal)>(
        r#"SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                  COALESCE(SUM(COALESCE(refund_amount, 0)), 0)
           FROM refund_requests
           WHERE status = 'admin_completed'
             AND created_at::date BETWEEN $1 AND $2
           GROUP BY month"#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let refund_map: std::collections::HashMap<String, BigDecimal> =
        refund_rows.into_iter().collect();

    let pnl: Vec<MonthlyPlatformPnL> = rows
        .into_iter()
        .map(|(month, gmv, commission)| {
            let withdrawal_fees = fee_map
                .get(&month)
                .cloned()
                .unwrap_or_else(|| BigDecimal::from(0));
            let refunds = refund_map
                .get(&month)
                .cloned()
                .unwrap_or_else(|| BigDecimal::from(0));
            let net_profit = &commission + &withdrawal_fees - &refunds;
            MonthlyPlatformPnL {
                month,
                gmv,
                commission,
                withdrawal_fees,
                refunds,
                net_profit,
            }
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": pnl })))
}

/// GET /api/admin/profit/export — XLSX download
async fn platform_profit_export(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    Query(params): Query<ProfitPeriodParams>,
) -> Result<(axum::http::StatusCode, axum::http::HeaderMap, Vec<u8>), AppError> {
    use rust_xlsxwriter::*;

    let (from, to) = default_range(&params);

    let rows = sqlx::query_as::<
        _,
        (
            String,
            Uuid,
            BigDecimal,
            BigDecimal,
            BigDecimal,
            String,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"SELECT order_number, seller_id, total_amount,
                  COALESCE(commission_amount, 0),
                  COALESCE(net_profit, 0),
                  status::text,
                  created_at
           FROM orders
           WHERE created_at::date BETWEEN $1 AND $2
             AND status IN ('delivered', 'confirmed')
           ORDER BY created_at DESC"#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let mut workbook = Workbook::new();
    let ws = workbook.add_worksheet();

    let headers = [
        "주문번호",
        "판매자 ID",
        "총액",
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
        format!(
            "attachment; filename=\"platform_profit_{}_{}.xlsx\"",
            from, to
        )
        .parse()
        .unwrap(),
    );

    Ok((axum::http::StatusCode::OK, headers_map, buf))
}

// NOTE: Add `pub mod profit;` to packages/backend/src/api/admin/mod.rs
// Then register routes in the admin read_router:
//   .merge(profit::admin_profit_router())
// Or wire it separately with `.nest("/admin", admin::profit::admin_profit_router())`
// in the admin_read section of api_router().
