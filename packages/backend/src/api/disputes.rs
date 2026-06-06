use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::domain::common::PaginationParams;
use crate::domain::dispute::*;
use crate::domain::notification::create_notification;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// User-facing dispute routes — all protected (auth_middleware applied in mod.rs)
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_dispute).get(list_my_disputes))
        .route("/{id}", get(get_dispute))
        .route("/{id}/messages", post(add_message))
}

// M-3: Admin dispute endpoints consolidated into api/admin/finance.rs
// (removed duplicate admin_read_router / admin_write_router / admin_resolve_dispute)

// --- POST /api/disputes ---

async fn create_dispute(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<DisputeCreateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate dispute_type
    if DisputeType::from_str(&req.dispute_type).is_none() {
        return Err(AppError::Validation {
            message:
                "Invalid dispute type. Must be one of: not_delivered, defective, wrong_item, other"
                    .into(),
            field: Some("dispute_type".into()),
        });
    }

    if req.reason.trim().is_empty() {
        return Err(AppError::Validation {
            message: "Reason is required".into(),
            field: Some("reason".into()),
        });
    }

    // Validate evidence count
    if let Some(ref evidence) = req.evidence {
        if evidence.len() > 5 {
            return Err(AppError::Validation {
                message: "Maximum 5 evidence images allowed".into(),
                field: Some("evidence".into()),
            });
        }
    }

    // H-1 FIX: Use transaction + FOR UPDATE to prevent race conditions
    let mut tx = state.db.begin().await?;

    // Check order exists, status, and ownership (lock row)
    let order = sqlx::query_as::<_, (Uuid, Uuid, crate::domain::order::OrderStatus, Option<Uuid>)>(
        r#"SELECT buyer_id, seller_id, status, dispute_id
           FROM orders WHERE id = $1 FOR UPDATE"#,
    )
    .bind(req.order_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    let (buyer_id, seller_id, status, existing_dispute) = order;

    if buyer_id != auth.id {
        return Err(AppError::Forbidden(
            "Only the buyer can file a dispute".into(),
        ));
    }

    if status != crate::domain::order::OrderStatus::Shipped
        && status != crate::domain::order::OrderStatus::Delivered
    {
        return Err(AppError::Validation {
            message: "Disputes can only be filed for shipped or delivered orders".into(),
            field: Some("order_id".into()),
        });
    }

    if existing_dispute.is_some() {
        return Err(AppError::Conflict(
            "A dispute already exists for this order".into(),
        ));
    }

    // Check monthly limit
    let dispute_count = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM disputes
           WHERE buyer_id = $1
           AND created_at >= date_trunc('month', NOW())"#,
    )
    .bind(auth.id)
    .fetch_one(&mut *tx)
    .await?;

    if dispute_count >= state.config.dispute_max_per_month as i64 {
        return Err(AppError::Validation {
            message: "Monthly dispute limit exceeded".into(),
            field: None,
        });
    }

    // Get the seller's user_id from seller_profiles
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_id)
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(seller_id); // fallback

    let dispute_id = Uuid::new_v4();
    let evidence_files = req.evidence.unwrap_or_default();

    // Insert dispute — seller_id references seller_profiles(id)
    sqlx::query(
        r#"INSERT INTO disputes (id, order_id, buyer_id, seller_id, dispute_type, reason, evidence_files, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')"#,
    )
    .bind(dispute_id)
    .bind(req.order_id)
    .bind(auth.id)
    .bind(seller_id)
    .bind(&req.dispute_type)
    .bind(&req.reason)
    .bind(&evidence_files)
    .execute(&mut *tx)
    .await?;

    // Update order status and dispute_id
    sqlx::query(
        "UPDATE orders SET status = 'disputed', dispute_id = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(req.order_id)
    .bind(dispute_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Notify seller
    let _ = create_notification(
        &state.db,
        Some(&state.ws_hub),
        seller_user_id,
        "dispute",
        "New dispute filed",
        &format!(
            "A dispute has been filed for your order. Type: {}",
            req.dispute_type
        ),
        Some(&format!("/disputes/{}", dispute_id)),
    )
    .await;

    Ok(Json(json!({
        "data": {
            "id": dispute_id,
            "order_id": req.order_id,
            "status": "open",
        }
    })))
}

// --- GET /api/disputes ---

async fn list_my_disputes(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM disputes WHERE buyer_id = $1 OR seller_id = (SELECT id FROM seller_profiles WHERE user_id = $1)",
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    let disputes = sqlx::query_as::<_, Dispute>(
        r#"SELECT id, order_id, buyer_id, seller_id, dispute_type,
                  reason, evidence_files, status, resolution, resolution_detail,
                  refund_amount, resolved_by, resolved_at, created_at, updated_at
           FROM disputes
           WHERE buyer_id = $1 OR seller_id = (SELECT id FROM seller_profiles WHERE user_id = $1)
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({
        "data": disputes,
        "pagination": crate::domain::common::Pagination::new(page, per_page, total),
    })))
}

// --- GET /api/disputes/:id ---

async fn get_dispute(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(dispute_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-22: Use shared dispute query helpers
    let dispute = find_dispute_by_id(&state.db, dispute_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Dispute not found".into()))?;

    // Check participant access — seller_id is seller_profiles.id, so look up user_id
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(dispute.seller_id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or(dispute.seller_id);

    if dispute.buyer_id != auth.id
        && seller_user_id != auth.id
        && auth.role != crate::domain::user::UserRole::Admin
    {
        return Err(AppError::Forbidden(
            "You are not a participant in this dispute".into(),
        ));
    }

    let messages = find_dispute_messages(&state.db, dispute_id).await?;

    // Flatten dispute fields + messages for frontend DisputeDetail type
    Ok(Json(json!({
        "data": {
            "id": dispute.id,
            "order_id": dispute.order_id,
            "buyer_id": dispute.buyer_id,
            "seller_id": dispute.seller_id,
            "dispute_type": dispute.dispute_type,
            "reason": dispute.reason,
            "evidence_files": dispute.evidence_files,
            "status": dispute.status,
            "resolution": dispute.resolution,
            "resolution_detail": dispute.resolution_detail,
            "refund_amount": dispute.refund_amount,
            "resolved_by": dispute.resolved_by,
            "resolved_at": dispute.resolved_at,
            "created_at": dispute.created_at,
            "updated_at": dispute.updated_at,
            "messages": messages,
        }
    })))
}

// --- POST /api/disputes/:id/messages ---

async fn add_message(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(dispute_id): Path<Uuid>,
    Json(req): Json<DisputeMessageRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.content.trim().is_empty() {
        return Err(AppError::Validation {
            message: "Message content is required".into(),
            field: Some("content".into()),
        });
    }

    // Fetch dispute and check participant
    let dispute = sqlx::query_as::<_, (Uuid, Uuid, String)>(
        "SELECT buyer_id, seller_id, status FROM disputes WHERE id = $1",
    )
    .bind(dispute_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Dispute not found".into()))?;

    let (buyer_id, seller_profile_id, status) = dispute;

    // seller_id references seller_profiles(id), so look up user_id
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_profile_id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or(seller_profile_id);

    if buyer_id != auth.id
        && seller_user_id != auth.id
        && auth.role != crate::domain::user::UserRole::Admin
    {
        return Err(AppError::Forbidden(
            "You are not a participant in this dispute".into(),
        ));
    }

    // Don't allow messages on resolved/closed disputes
    if status == "resolved" || status == "closed" {
        return Err(AppError::Validation {
            message: "Cannot add messages to a resolved or closed dispute".into(),
            field: None,
        });
    }

    let sender_role = if auth.role == crate::domain::user::UserRole::Admin {
        "admin".to_string()
    } else if auth.id == buyer_id {
        "buyer".to_string()
    } else {
        "seller".to_string()
    };

    let attachments_json =
        serde_json::to_value(req.attachments.unwrap_or_default()).unwrap_or_else(|_| json!([]));

    let msg_id = Uuid::new_v4();

    sqlx::query(
        r#"INSERT INTO dispute_messages (id, dispute_id, sender_id, sender_role, content, attachments)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(msg_id)
    .bind(dispute_id)
    .bind(auth.id)
    .bind(&sender_role)
    .bind(&req.content)
    .bind(&attachments_json)
    .execute(&state.db)
    .await?;

    // If seller responds and status is 'open', update to 'responded'
    if sender_role == "seller" && status == "open" {
        sqlx::query("UPDATE disputes SET status = 'responded', updated_at = NOW() WHERE id = $1")
            .bind(dispute_id)
            .execute(&state.db)
            .await?;
    }

    // Notify the other party
    let notify_user = if auth.id == buyer_id {
        seller_user_id
    } else {
        buyer_id
    };
    let _ = create_notification(
        &state.db,
        Some(&state.ws_hub),
        notify_user,
        "dispute",
        "New dispute message",
        "A new message has been added to your dispute.",
        Some(&format!("/disputes/{}", dispute_id)),
    )
    .await;

    Ok(Json(json!({
        "data": {
            "id": msg_id,
            "dispute_id": dispute_id,
            "sender_role": sender_role,
        }
    })))
}
