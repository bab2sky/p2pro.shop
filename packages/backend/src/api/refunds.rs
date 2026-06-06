use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::domain::common::Pagination;
use crate::domain::refund::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Buyer refund routes (nested under /refunds, auth required)
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_my_refunds))
        .route("/{id}", get(get_refund_detail))
}

/// Order-level refund route (nested under /orders)
pub fn order_refund_router() -> Router<AppState> {
    Router::new().route("/{id}/refund", post(create_refund_request))
}

// --- POST /api/orders/{id}/refund ---

async fn create_refund_request(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
    Json(req): Json<CreateRefundRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate reason_code
    if RefundReasonCode::from_str(&req.reason_code).is_none() {
        return Err(AppError::Validation {
            message: "Invalid reason code. Must be one of: defective, wrong_item, not_delivered, not_as_described, change_of_mind, other".into(),
            field: Some("reason_code".into()),
        });
    }

    if req.reason.trim().is_empty() {
        return Err(AppError::Validation {
            message: "Reason is required".into(),
            field: Some("reason".into()),
        });
    }

    // Validate evidence images count
    if let Some(ref images) = req.evidence_images {
        if images.len() > 5 {
            return Err(AppError::Validation {
                message: "Maximum 5 evidence images allowed".into(),
                field: Some("evidence_images".into()),
            });
        }
    }

    // M-2: Use transaction + FOR UPDATE to prevent race conditions
    let mut tx = state.db.begin().await?;

    // Lock the order row to prevent concurrent refund requests
    let order = sqlx::query_as::<_, (Uuid, Uuid, String, bool)>(
        "SELECT buyer_id, seller_id, status::TEXT, COALESCE(refund_blocked, FALSE) FROM orders WHERE id = $1 FOR UPDATE",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    let (buyer_id, seller_id, status, refund_blocked) = order;

    if buyer_id != auth.id {
        return Err(AppError::Forbidden(
            "Only the buyer can request a refund".into(),
        ));
    }

    // FR-06: UDG 보상 분배 완료 후 환불 차단
    if refund_blocked {
        return Err(AppError::Validation {
            message: "UDG 보상 분배 완료 후 환불이 불가합니다".into(),
            field: Some("order_id".into()),
        });
    }

    // Check refundable status
    if !["payment_verified", "shipped", "delivered"].contains(&status.as_str()) {
        return Err(AppError::Validation {
            message: "Order status does not allow refund. Refund is only available for payment_verified, shipped, or delivered orders.".into(),
            field: Some("order_id".into()),
        });
    }

    // Check no existing refund (within transaction)
    let existing =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM refund_requests WHERE order_id = $1 LIMIT 1")
            .bind(order_id)
            .fetch_optional(&mut *tx)
            .await?;

    if existing.is_some() {
        return Err(AppError::Conflict(
            "Refund request already exists for this order".into(),
        ));
    }

    // Create refund request
    let evidence_json = req
        .evidence_images
        .as_ref()
        .map(|imgs| serde_json::to_value(imgs).unwrap_or_default())
        .unwrap_or(serde_json::Value::Array(vec![]));

    let row = sqlx::query_as::<_, (Uuid, String, chrono::DateTime<chrono::Utc>)>(
        r#"INSERT INTO refund_requests (order_id, buyer_id, seller_id, reason_code, reason, evidence_images)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING id, status, created_at"#,
    )
    .bind(order_id)
    .bind(buyer_id)
    .bind(seller_id)
    .bind(&req.reason_code)
    .bind(&req.reason)
    .bind(&evidence_json)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Notify seller
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_id)
            .fetch_optional(&state.db)
            .await?;

    if let Some(seller_uid) = seller_user_id {
        let order_number =
            sqlx::query_scalar::<_, String>("SELECT order_number FROM orders WHERE id = $1")
                .bind(order_id)
                .fetch_optional(&state.db)
                .await?
                .unwrap_or_default();

        let _ = crate::domain::notification::create_notification(
            &state.db,
            Some(&state.ws_hub),
            seller_uid,
            "refund",
            "환불 요청",
            &format!("주문 #{}에 대한 환불 요청이 접수되었습니다.", order_number),
            Some("/seller/refunds"),
        )
        .await;
    }

    Ok(Json(json!({
        "data": {
            "refund_id": row.0,
            "status": row.1,
            "created_at": row.2,
        }
    })))
}

// --- GET /api/refunds ---

async fn list_my_refunds(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<RefundListQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let query = format!(
        "SELECT {} {} WHERE rr.buyer_id = $1 ORDER BY rr.created_at DESC LIMIT $2 OFFSET $3",
        REFUND_WITH_INFO_SELECT, REFUND_WITH_INFO_JOIN
    );

    let refunds = sqlx::query_as::<_, RefundRequestWithInfo>(&query)
        .bind(auth.id)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

    let total = refunds.first().and_then(|r| r.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": refunds,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

// --- GET /api/refunds/{id} ---

async fn get_refund_detail(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(refund_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let query = format!(
        "SELECT {} {} WHERE rr.id = $1",
        REFUND_WITH_INFO_SELECT, REFUND_WITH_INFO_JOIN
    );

    let refund = sqlx::query_as::<_, RefundRequestWithInfo>(&query)
        .bind(refund_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Refund request not found".into()))?;

    // Check access: buyer or seller's user_id
    if refund.buyer_id != auth.id {
        let seller_user_id =
            sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
                .bind(refund.seller_id)
                .fetch_optional(&state.db)
                .await?;

        if seller_user_id != Some(auth.id) {
            return Err(AppError::Forbidden("Access denied".into()));
        }
    }

    Ok(Json(json!({ "data": refund })))
}
