use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post},
    Extension, Json, Router,
};
use bigdecimal::BigDecimal;
use uuid::Uuid;

use crate::domain::analytics::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Seller analytics routes
pub fn seller_router() -> Router<AppState> {
    Router::new()
        .route("/analytics/sales", get(sales_summary))
        .route("/analytics/sales/chart", get(sales_chart_data))
        .route("/analytics/top-products", get(top_products))
        .route("/analytics/response-time", get(response_time))
}

/// Time deal routes (seller)
pub fn time_deal_seller_router() -> Router<AppState> {
    Router::new()
        .route("/time-deals", post(create_time_deal))
        .route("/time-deals", get(list_seller_time_deals))
        .route("/time-deals/{id}", delete(delete_time_deal))
}

/// Time deal public routes
pub fn time_deal_public_router() -> Router<AppState> {
    Router::new().route("/time-deals/active", get(list_active_time_deals))
}

/// Regional surcharge public routes
pub fn surcharge_router() -> Router<AppState> {
    Router::new()
        .route("/surcharges/check", get(check_surcharge))
        .route("/surcharges", get(list_surcharges))
}

// --- Analytics Handlers ---

// 공통 helper — auth.id (users.id) → seller_profiles(id) 변환.
//
// 이전 구현은 WHERE oi.seller_id = $1 .bind(auth.id) 패턴이었는데,
// (a) order_items 에 seller_id 컬럼 자체가 없어 SQL 에러,
// (b) 컬럼이 있다 해도 auth.id (users) ↔ seller_profiles 비교 불일치.
// 두 가지 모두 해소: orders.seller_id (= seller_profiles.id) 로 직접 합산.
async fn resolve_seller_id(db: &sqlx::PgPool, user_id: Uuid) -> Result<Uuid, AppError> {
    crate::domain::settlement::get_seller_id_any_status(db, user_id)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to resolve seller: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))
}

/// GET /api/seller/analytics/sales — FR-D10 매출 요약
async fn sales_summary(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<AnalyticsPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let start = params
        .start_date
        .unwrap_or(chrono::Utc::now().date_naive() - chrono::Duration::days(30));
    let end = params.end_date.unwrap_or(chrono::Utc::now().date_naive());
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    // 매출 합산 — settlement / profit summary 와 동일 status 정책
    // (delivered/confirmed only, pending_payment 등은 미실현이라 제외).
    // order_items.seller_id 컬럼 부재로 oi 대신 orders 직접 합산.
    let summary = sqlx::query_as::<_, (BigDecimal, i64, i64)>(
        r#"SELECT COALESCE(SUM(oi.subtotal), 0),
                  COUNT(DISTINCT o.id),
                  COALESCE(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.seller_id = $1
             AND o.created_at::date BETWEEN $2 AND $3
             AND o.status IN ('delivered', 'confirmed')"#,
    )
    .bind(seller_id)
    .bind(start)
    .bind(end)
    .fetch_one(&state.db)
    .await?;

    let total_orders = summary.1;
    let avg = if total_orders > 0 {
        &summary.0 / BigDecimal::from(total_orders)
    } else {
        BigDecimal::from(0)
    };

    Ok(Json(serde_json::json!({
        "data": SalesSummary {
            total_sales: summary.0,
            total_orders,
            avg_order_value: avg,
            total_items_sold: summary.2,
        }
    })))
}

/// GET /api/seller/analytics/sales/chart — FR-D10 일별 매출 차트
async fn sales_chart_data(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<AnalyticsPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let start = params
        .start_date
        .unwrap_or(chrono::Utc::now().date_naive() - chrono::Duration::days(30));
    let end = params.end_date.unwrap_or(chrono::Utc::now().date_naive());
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    let rows = sqlx::query_as::<_, (chrono::NaiveDate, BigDecimal, i64)>(
        r#"SELECT o.created_at::date as sale_date,
                  COALESCE(SUM(oi.subtotal), 0) as daily_sales,
                  COUNT(DISTINCT o.id) as daily_orders
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.seller_id = $1
             AND o.created_at::date BETWEEN $2 AND $3
             AND o.status IN ('delivered', 'confirmed')
           GROUP BY sale_date
           ORDER BY sale_date"#,
    )
    .bind(seller_id)
    .bind(start)
    .bind(end)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<DailySalesData> = rows
        .into_iter()
        .map(|(date, sales, orders)| DailySalesData {
            date,
            sales,
            orders,
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": data })))
}

/// GET /api/seller/analytics/top-products — Top selling products
async fn top_products(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<AnalyticsPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let start = params
        .start_date
        .unwrap_or(chrono::Utc::now().date_naive() - chrono::Duration::days(30));
    let end = params.end_date.unwrap_or(chrono::Utc::now().date_naive());
    let seller_id = resolve_seller_id(&state.db, auth.id).await?;

    let rows = sqlx::query_as::<_, (Uuid, String, i64, BigDecimal)>(
        r#"SELECT oi.product_id, p.title,
                  SUM(oi.quantity)::bigint as sold_qty,
                  SUM(oi.subtotal) as revenue
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           WHERE o.seller_id = $1
             AND o.created_at::date BETWEEN $2 AND $3
             AND o.status IN ('delivered', 'confirmed')
           GROUP BY oi.product_id, p.title
           ORDER BY revenue DESC
           LIMIT 10"#,
    )
    .bind(seller_id)
    .bind(start)
    .bind(end)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<TopProduct> = rows
        .into_iter()
        .map(|(id, title, qty, rev)| TopProduct {
            product_id: id.to_string(),
            title,
            sold_quantity: qty,
            revenue: rev,
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": data })))
}

/// GET /api/seller/analytics/response-time — FR-D13 응답 시간 분석
async fn response_time(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<AnalyticsPeriodParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let start = params
        .start_date
        .unwrap_or(chrono::Utc::now().date_naive() - chrono::Duration::days(30));
    let end = params.end_date.unwrap_or(chrono::Utc::now().date_naive());

    // Average response time for order inquiries
    let inquiry_avg = sqlx::query_scalar::<_, Option<f64>>(
        r#"SELECT AVG(EXTRACT(EPOCH FROM (replied_at - created_at)) / 3600)
           FROM order_inquiries
           WHERE seller_id = $1
             AND replied_at IS NOT NULL
             AND created_at::date BETWEEN $2 AND $3"#,
    )
    .bind(auth.id)
    .bind(start)
    .bind(end)
    .fetch_one(&state.db)
    .await?;

    // Average response time for QnA
    let qna_avg = sqlx::query_scalar::<_, Option<f64>>(
        r#"SELECT AVG(EXTRACT(EPOCH FROM (answered_at - created_at)) / 3600)
           FROM product_qna
           WHERE seller_id = $1
             AND answered_at IS NOT NULL
             AND created_at::date BETWEEN $2 AND $3"#,
    )
    .bind(auth.id)
    .bind(start)
    .bind(end)
    .fetch_one(&state.db)
    .await?;

    // Pending counts
    let pending_inquiries = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM order_inquiries
           WHERE seller_id = $1 AND status = 'pending'"#,
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    let pending_qna = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM product_qna
           WHERE seller_id = $1 AND answered_at IS NULL"#,
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": {
            "avg_inquiry_response_hours": inquiry_avg.unwrap_or(0.0),
            "avg_qna_response_hours": qna_avg.unwrap_or(0.0),
            "pending_inquiries": pending_inquiries,
            "pending_qna": pending_qna,
        }
    })))
}

// --- Time Deal Handlers ---

/// POST /api/seller/time-deals — FR-D12 타임딜 생성
async fn create_time_deal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateTimeDealRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c (migration 046): time_deals.seller_id == seller_profiles(id).
    // products.seller_id 도 sp.id 라 동일 키체계로 ownership 검사 가능.
    let seller_profile_id =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    // Verify product ownership (products.seller_id == sp.id)
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND seller_id = $2)",
    )
    .bind(req.product_id)
    .bind(seller_profile_id)
    .fetch_one(&state.db)
    .await?;

    if !owned {
        return Err(AppError::Forbidden("Product not owned by seller".into()));
    }

    let starts_at: chrono::DateTime<chrono::Utc> =
        req.starts_at.parse().map_err(|_| AppError::Validation {
            message: "Invalid starts_at datetime".into(),
            field: Some("starts_at".into()),
        })?;
    let ends_at: chrono::DateTime<chrono::Utc> =
        req.ends_at.parse().map_err(|_| AppError::Validation {
            message: "Invalid ends_at datetime".into(),
            field: Some("ends_at".into()),
        })?;

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO time_deals (id, product_id, seller_id, deal_price, original_price, max_quantity, starts_at, ends_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')"#,
    )
    .bind(id)
    .bind(req.product_id)
    .bind(seller_profile_id)
    .bind(&req.deal_price)
    .bind(&req.original_price)
    .bind(req.max_quantity)
    .bind(starts_at)
    .bind(ends_at)
    .execute(&state.db)
    .await?;

    Ok(Json(
        serde_json::json!({ "data": { "id": id, "status": "pending" } }),
    ))
}

/// GET /api/seller/time-deals — Seller's time deals
async fn list_seller_time_deals(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let deals = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            BigDecimal,
            BigDecimal,
            Option<i32>,
            i32,
            String,
            String,
            bool,
            String,
            Option<String>,
        ),
    >(
        // Round 6c: time_deals.seller_id == seller_profiles(id).
        r#"SELECT td.id, td.product_id, p.title,
                  td.deal_price, td.original_price,
                  td.max_quantity, td.sold_quantity,
                  td.starts_at::text, td.ends_at::text, td.is_active,
                  td.status, td.rejected_reason
           FROM time_deals td
           JOIN products p ON p.id = td.product_id
           JOIN seller_profiles sp ON sp.id = td.seller_id
           WHERE sp.user_id = $1
           ORDER BY td.created_at DESC"#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<serde_json::Value> = deals
        .into_iter()
        .map(
            |(id, pid, title, dp, op, mq, sq, sa, ea, active, status, rejected_reason)| {
                let discount = if op > 0 {
                    let diff = &op - &dp;
                    let pct = (&diff * BigDecimal::from(100)) / &op;
                    pct.to_string().parse::<f64>().unwrap_or(0.0) as i32
                } else {
                    0
                };
                serde_json::json!({
                    "id": id, "product_id": pid, "product_title": title,
                    "deal_price": dp, "original_price": op,
                    "discount_percent": discount,
                    "max_quantity": mq, "sold_quantity": sq,
                    "starts_at": sa, "ends_at": ea, "is_active": active,
                    "status": status, "rejected_reason": rejected_reason,
                })
            },
        )
        .collect();

    Ok(Json(serde_json::json!({ "data": data })))
}

/// DELETE /api/seller/time-deals/{id}
async fn delete_time_deal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(deal_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c: time_deals.seller_id == seller_profiles(id).
    let result = sqlx::query(
        "DELETE FROM time_deals WHERE id = $1 AND seller_id = (SELECT id FROM seller_profiles WHERE user_id = $2)",
    )
    .bind(deal_id)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Time deal not found".into()));
    }

    Ok(Json(serde_json::json!({ "data": { "deleted": true } })))
}

/// GET /api/time-deals/active — Public active time deals
async fn list_active_time_deals(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let deals = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            Option<String>,
            BigDecimal,
            BigDecimal,
            Option<i32>,
            i32,
            String,
            String,
        ),
    >(
        r#"SELECT td.id, td.product_id, p.title, p.images[1],
                  td.deal_price, td.original_price,
                  td.max_quantity, td.sold_quantity,
                  td.starts_at::text, td.ends_at::text
           FROM time_deals td
           JOIN products p ON p.id = td.product_id
           WHERE td.is_active = true AND td.status = 'approved'
             AND td.starts_at <= NOW() AND td.ends_at > NOW()
             AND (td.max_quantity IS NULL OR td.sold_quantity < td.max_quantity)
           ORDER BY td.ends_at ASC
           LIMIT 20"#,
    )
    .fetch_all(&state.db)
    .await;

    // If images column type differs, handle gracefully
    let deals = match deals {
        Ok(d) => d,
        Err(_) => {
            // Fallback without images
            sqlx::query_as::<
                _,
                (
                    Uuid,
                    Uuid,
                    String,
                    Option<String>,
                    BigDecimal,
                    BigDecimal,
                    Option<i32>,
                    i32,
                    String,
                    String,
                ),
            >(
                r#"SELECT td.id, td.product_id, p.title, NULL::text,
                          td.deal_price, td.original_price,
                          td.max_quantity, td.sold_quantity,
                          td.starts_at::text, td.ends_at::text
                   FROM time_deals td
                   JOIN products p ON p.id = td.product_id
                   WHERE td.is_active = true
                     AND td.starts_at <= NOW() AND td.ends_at > NOW()
                   ORDER BY td.ends_at ASC
                   LIMIT 20"#,
            )
            .fetch_all(&state.db)
            .await?
        }
    };

    let data: Vec<serde_json::Value> = deals
        .into_iter()
        .map(|(id, pid, title, img, dp, op, mq, sq, sa, ea)| {
            serde_json::json!({
                "id": id, "product_id": pid, "title": title, "image": img,
                "deal_price": dp, "original_price": op,
                "max_quantity": mq, "sold_quantity": sq,
                "starts_at": sa, "ends_at": ea,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": data })))
}

// --- Admin Time Deal Handlers ---

/// GET /api/admin/time-deals — list all time deals for admin
pub async fn admin_list_time_deals(
    State(state): State<AppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let status_filter = params.get("status").map(|s| s.as_str()).unwrap_or("all");
    let page: i64 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let per_page: i64 = params
        .get("per_page")
        .and_then(|p| p.parse().ok())
        .unwrap_or(20);
    let offset = (page - 1) * per_page;

    let deals = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            String,
            BigDecimal,
            BigDecimal,
            Option<i32>,
            i32,
            String,
            String,
            bool,
            String,
            Option<String>,
            Option<String>,
            i64,
        ),
    >(
        r#"SELECT td.id, td.product_id, p.title, COALESCE(u.nickname, u.real_name),
                  td.deal_price, td.original_price,
                  td.max_quantity, td.sold_quantity,
                  td.starts_at::text, td.ends_at::text, td.is_active,
                  td.status, td.rejected_reason, td.created_at::text,
                  COUNT(*) OVER() as total_count
           FROM time_deals td
           JOIN products p ON p.id = td.product_id
           JOIN users u ON u.id = td.seller_id
           WHERE ($3 = 'all' OR td.status = $3)
           ORDER BY td.created_at DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(per_page)
    .bind(offset)
    .bind(status_filter)
    .fetch_all(&state.db)
    .await?;

    let total = deals.first().map(|d| d.14).unwrap_or(0);

    let data: Vec<serde_json::Value> = deals
        .into_iter()
        .map(
            |(
                id,
                pid,
                title,
                seller,
                dp,
                op,
                mq,
                sq,
                sa,
                ea,
                active,
                status,
                reason,
                created,
                _,
            )| {
                let discount = if op > 0 {
                    let diff = &op - &dp;
                    let pct = (&diff * BigDecimal::from(100)) / &op;
                    pct.to_string().parse::<f64>().unwrap_or(0.0) as i32
                } else {
                    0
                };
                serde_json::json!({
                    "id": id, "product_id": pid, "product_title": title, "seller_name": seller,
                    "deal_price": dp, "original_price": op, "discount_percent": discount,
                    "max_quantity": mq, "sold_quantity": sq,
                    "starts_at": sa, "ends_at": ea, "is_active": active,
                    "status": status, "rejected_reason": reason, "created_at": created,
                })
            },
        )
        .collect();

    Ok(Json(serde_json::json!({
        "data": data,
        "pagination": { "page": page, "per_page": per_page, "total": total }
    })))
}

/// PUT /api/admin/time-deals/{id}/approve
pub async fn admin_approve_time_deal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(deal_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query(
        "UPDATE time_deals SET status = 'approved', is_active = true, approved_at = NOW(), approved_by = $2 WHERE id = $1 AND status = 'pending'"
    )
    .bind(deal_id)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Time deal not found or not pending".into(),
        ));
    }

    let _ = crate::domain::admin::log_admin_action(
        &state.db,
        auth.id,
        "time_deal_approve",
        "time_deal",
        deal_id,
        None,
        None,
    )
    .await;

    Ok(Json(serde_json::json!({ "data": { "approved": true } })))
}

/// PUT /api/admin/time-deals/{id}/reject
pub async fn admin_reject_time_deal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(deal_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let reason = body.get("reason").and_then(|r| r.as_str()).unwrap_or("");

    let result = sqlx::query(
        "UPDATE time_deals SET status = 'rejected', is_active = false, rejected_reason = $2 WHERE id = $1 AND status = 'pending'"
    )
    .bind(deal_id)
    .bind(reason)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Time deal not found or not pending".into(),
        ));
    }

    let _ = crate::domain::admin::log_admin_action(
        &state.db,
        auth.id,
        "time_deal_reject",
        "time_deal",
        deal_id,
        Some(serde_json::json!({ "reason": reason })),
        None,
    )
    .await;

    Ok(Json(serde_json::json!({ "data": { "rejected": true } })))
}

// --- Surcharge Handlers ---

/// GET /api/surcharges/check — FR-D05 도서산간 배송비 확인
async fn check_surcharge(
    State(state): State<AppState>,
    Query(req): Query<CheckSurchargeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let surcharges = sqlx::query_as::<_, (String, BigDecimal)>(
        r#"SELECT region_name, surcharge
           FROM regional_surcharges
           WHERE is_active = true
             AND EXISTS (
                 SELECT 1 FROM unnest(zipcode_prefixes) prefix
                 WHERE $1 LIKE prefix || '%'
             )"#,
    )
    .bind(&req.zipcode)
    .fetch_all(&state.db)
    .await?;

    if surcharges.is_empty() {
        Ok(Json(serde_json::json!({
            "data": { "has_surcharge": false, "surcharge": 0, "region": null }
        })))
    } else {
        let (region, amount) = &surcharges[0];
        Ok(Json(serde_json::json!({
            "data": { "has_surcharge": true, "surcharge": amount, "region": region }
        })))
    }
}

/// GET /api/surcharges — List all surcharge regions
async fn list_surcharges(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let surcharges = sqlx::query_as::<_, (Uuid, String, Vec<String>, BigDecimal, bool)>(
        r#"SELECT id, region_name, zipcode_prefixes, surcharge, is_active
           FROM regional_surcharges
           WHERE is_active = true
           ORDER BY region_name"#,
    )
    .fetch_all(&state.db)
    .await?;

    let data: Vec<serde_json::Value> = surcharges
        .into_iter()
        .map(|(id, name, prefixes, amount, active)| {
            serde_json::json!({
                "id": id, "region_name": name,
                "zipcode_prefixes": prefixes,
                "surcharge": amount, "is_active": active,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": data })))
}
