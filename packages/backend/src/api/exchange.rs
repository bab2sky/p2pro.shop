use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::domain::common::PaginationParams;
use crate::domain::exchange::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Buyer exchange routes
pub fn buyer_router() -> Router<AppState> {
    Router::new()
        .route("/exchanges", post(create_exchange))
        .route("/exchanges", get(list_my_exchanges))
        .route("/exchanges/{id}/tracking", put(update_exchange_tracking))
}

/// Seller exchange routes
pub fn seller_router() -> Router<AppState> {
    Router::new()
        .route("/exchanges", get(list_seller_exchanges))
        .route("/exchanges/{id}/respond", put(respond_exchange))
}

/// Buyer inquiry routes
pub fn inquiry_buyer_router() -> Router<AppState> {
    Router::new()
        .route("/inquiries", post(create_inquiry))
        .route("/inquiries", get(list_my_inquiries))
}

/// Seller inquiry routes
pub fn inquiry_seller_router() -> Router<AppState> {
    Router::new()
        .route("/inquiries", get(list_seller_inquiries))
        .route("/inquiries/{id}/reply", put(reply_inquiry))
}

// --- Exchange Handlers ---

/// POST /api/exchanges — FR-D06 교환 요청
async fn create_exchange(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateExchangeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let valid_reasons = [
        "wrong_size",
        "wrong_color",
        "defective",
        "wrong_product",
        "other",
    ];
    if !valid_reasons.contains(&req.reason_code.as_str()) {
        return Err(AppError::Validation {
            message: "Invalid reason_code".into(),
            field: Some("reason_code".into()),
        });
    }

    // Verify order belongs to buyer and get seller_profile_id (orders.seller_id == sp.id).
    // FIX: order_items 에는 seller_id 컬럼이 없으므로 orders.seller_id 직접 사용.
    // Round 6c (migration 046): exchange_requests.seller_id == seller_profiles(id) 로 표준화.
    let order_info = sqlx::query_as::<_, (Uuid, Uuid)>(
        r#"SELECT o.buyer_id, o.seller_id
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           WHERE o.id = $1 AND oi.id = $2"#,
    )
    .bind(req.order_id)
    .bind(req.order_item_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Order or item not found".into()))?;

    if order_info.0 != auth.id {
        return Err(AppError::Forbidden("Not the order buyer".into()));
    }

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO exchange_requests
           (id, order_id, order_item_id, buyer_id, seller_id, reason_code, reason_detail, desired_option)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(id)
    .bind(req.order_id)
    .bind(req.order_item_id)
    .bind(auth.id)
    .bind(order_info.1)
    .bind(&req.reason_code)
    .bind(&req.reason_detail)
    .bind(&req.desired_option)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "id": id } })))
}

/// GET /api/exchanges — My exchange requests
async fn list_my_exchanges(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let exchanges = sqlx::query_as::<_, ExchangeRequest>(
        r#"SELECT * FROM exchange_requests
           WHERE buyer_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(params.per_page())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": exchanges })))
}

/// PUT /api/exchanges/{id}/tracking — Buyer sends return tracking
async fn update_exchange_tracking(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(exchange_id): Path<Uuid>,
    Json(req): Json<ExchangeTrackingRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query(
        r#"UPDATE exchange_requests SET
           return_tracking_number = $2, return_carrier = $3,
           status = 'buyer_shipped', updated_at = NOW()
           WHERE id = $1 AND buyer_id = $4 AND status = 'approved'"#,
    )
    .bind(exchange_id)
    .bind(&req.return_tracking_number)
    .bind(&req.return_carrier)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Exchange not found or not in approved status".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

/// GET /api/seller/exchanges — Seller's exchange requests
async fn list_seller_exchanges(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c: exchange_requests.seller_id == seller_profiles(id).
    let exchanges = sqlx::query_as::<_, ExchangeRequest>(
        r#"SELECT er.* FROM exchange_requests er
           JOIN seller_profiles sp ON sp.id = er.seller_id
           WHERE sp.user_id = $1
           ORDER BY er.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(params.per_page())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": exchanges })))
}

/// PUT /api/seller/exchanges/{id}/respond — Seller approves/rejects exchange
async fn respond_exchange(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(exchange_id): Path<Uuid>,
    Json(req): Json<UpdateExchangeStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let valid_statuses = [
        "approved",
        "rejected",
        "seller_received",
        "seller_reshipped",
        "completed",
    ];
    if !valid_statuses.contains(&req.status.as_str()) {
        return Err(AppError::Validation {
            message: "Invalid status".into(),
            field: Some("status".into()),
        });
    }

    // Round 6c: exchange_requests.seller_id == seller_profiles(id).
    let result = sqlx::query(
        r#"UPDATE exchange_requests SET
           status = $2, seller_response = COALESCE($3, seller_response),
           new_tracking_number = COALESCE($4, new_tracking_number),
           new_carrier = COALESCE($5, new_carrier),
           responded_at = CASE WHEN responded_at IS NULL THEN NOW() ELSE responded_at END,
           updated_at = NOW()
           WHERE id = $1 AND seller_id = (SELECT id FROM seller_profiles WHERE user_id = $6)"#,
    )
    .bind(exchange_id)
    .bind(&req.status)
    .bind(&req.seller_response)
    .bind(&req.new_tracking_number)
    .bind(&req.new_carrier)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Exchange not found".into()));
    }

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

// --- Inquiry Handlers ---

/// POST /api/inquiries — FR-D07 주문 문의
async fn create_inquiry(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateInquiryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let valid_types = ["shipping", "product", "exchange", "refund", "etc"];
    if !valid_types.contains(&req.inquiry_type.as_str()) {
        return Err(AppError::Validation {
            message: "Invalid inquiry_type".into(),
            field: Some("inquiry_type".into()),
        });
    }

    // Get seller from order. orders.seller_id == seller_profiles(id).
    // FIX: order_items 에는 seller_id 컬럼이 없으므로 orders.seller_id 사용.
    // Round 6c: order_inquiries.seller_id == seller_profiles(id) 로 표준화.
    let seller_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT seller_id FROM orders WHERE id = $1",
    )
    .bind(req.order_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    let id = Uuid::new_v4();
    let images_json = req
        .images
        .map(|imgs| serde_json::to_value(imgs).unwrap_or_default());

    sqlx::query(
        r#"INSERT INTO order_inquiries
           (id, order_id, buyer_id, seller_id, inquiry_type, title, content, images)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(id)
    .bind(req.order_id)
    .bind(auth.id)
    .bind(seller_id)
    .bind(&req.inquiry_type)
    .bind(&req.title)
    .bind(&req.content)
    .bind(&images_json)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "id": id } })))
}

/// GET /api/inquiries — My inquiries
async fn list_my_inquiries(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let inquiries = sqlx::query_as::<_, OrderInquiry>(
        r#"SELECT * FROM order_inquiries
           WHERE buyer_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(params.per_page())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": inquiries })))
}

/// GET /api/seller/inquiries — Seller's inquiries
async fn list_seller_inquiries(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c: order_inquiries.seller_id == seller_profiles(id).
    let inquiries = sqlx::query_as::<_, OrderInquiry>(
        r#"SELECT oin.* FROM order_inquiries oin
           JOIN seller_profiles sp ON sp.id = oin.seller_id
           WHERE sp.user_id = $1
           ORDER BY oin.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(params.per_page())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": inquiries })))
}

/// PUT /api/seller/inquiries/{id}/reply — Seller replies to inquiry
async fn reply_inquiry(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(inquiry_id): Path<Uuid>,
    Json(req): Json<ReplyInquiryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c: order_inquiries.seller_id == seller_profiles(id).
    let result = sqlx::query(
        r#"UPDATE order_inquiries SET
           seller_reply = $2, status = 'replied', replied_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND seller_id = (SELECT id FROM seller_profiles WHERE user_id = $3)"#,
    )
    .bind(inquiry_id)
    .bind(&req.seller_reply)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Inquiry not found".into()));
    }

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}
