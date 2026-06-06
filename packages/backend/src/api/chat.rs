use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::chat::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/rooms", post(create_room))
        .route("/rooms", get(list_rooms))
        .route("/rooms/{id}/messages", get(get_messages))
        .route("/rooms/{id}/read", put(mark_read))
        .route("/rooms/{id}/image", post(send_image_message))
        .route("/rooms/{id}/search", get(search_messages))
        .route("/unread-count", get(get_total_unread_count))
}

/// POST /chat/rooms — Create or get existing chat room for an order
async fn create_room(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify the order exists and the user is buyer or seller
    let order = sqlx::query_as::<_, (Uuid, Uuid, Uuid)>(
        "SELECT id, buyer_id, seller_id FROM orders WHERE id = $1",
    )
    .bind(req.order_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    let (_order_id, buyer_id, seller_profile_id) = order;

    // Resolve seller user_id from seller_profiles
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_profile_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller not found".into()))?;

    // Verify current user is buyer or seller
    if auth.id != buyer_id && auth.id != seller_user_id {
        return Err(AppError::Forbidden("Not authorized for this order".into()));
    }

    // FR-17: Atomic upsert — ON CONFLICT prevents race condition (duplicate room creation)
    let room = sqlx::query_as::<_, ChatRoom>(
        r#"INSERT INTO chat_rooms (id, order_id, buyer_id, seller_id, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (order_id) DO UPDATE SET order_id = EXCLUDED.order_id
           RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(req.order_id)
    .bind(buyer_id)
    .bind(seller_user_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": room })))
}

/// GET /chat/rooms — List my chat rooms with last message and unread count
async fn list_rooms(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-03: Replace 3 correlated subqueries with JOINs + LATERAL
    let rooms = sqlx::query_as::<_, ChatRoomWithInfo>(
        r#"SELECT
            cr.id,
            cr.order_id,
            CASE WHEN cr.buyer_id = $1 THEN cr.seller_id ELSE cr.buyer_id END AS other_user_id,
            COALESCE(u.nickname, u.username) AS other_user_nickname,
            lm.content AS last_message,
            cr.last_message_at,
            COALESCE(unread.cnt, 0) AS unread_count
           FROM chat_rooms cr
           JOIN users u ON u.id = CASE WHEN cr.buyer_id = $1 THEN cr.seller_id ELSE cr.buyer_id END
           LEFT JOIN LATERAL (
               SELECT content FROM chat_messages
               WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1
           ) lm ON true
           LEFT JOIN LATERAL (
               SELECT COUNT(*) AS cnt FROM chat_messages
               WHERE room_id = cr.id AND sender_id != $1 AND is_read = false
           ) unread ON true
           WHERE cr.buyer_id = $1 OR cr.seller_id = $1
           ORDER BY COALESCE(cr.last_message_at, cr.created_at) DESC"#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": rooms })))
}

#[derive(Debug, Deserialize)]
pub struct MessageQueryParams {
    pub before: Option<Uuid>,
    pub limit: Option<i64>,
}

/// GET /chat/rooms/:id/messages — Message history (cursor-based)
async fn get_messages(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
    Query(params): Query<MessageQueryParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify user is participant
    let is_participant = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2))",
    )
    .bind(room_id)
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if !is_participant {
        return Err(AppError::Forbidden(
            "Not a participant of this chat room".into(),
        ));
    }

    let limit = params.limit.unwrap_or(50).min(100);

    let messages = if let Some(before_id) = params.before {
        // Get the created_at of the cursor message
        let cursor_time = sqlx::query_scalar::<_, chrono::DateTime<chrono::Utc>>(
            "SELECT created_at FROM chat_messages WHERE id = $1",
        )
        .bind(before_id)
        .fetch_optional(&state.db)
        .await?;

        match cursor_time {
            Some(ct) => {
                sqlx::query_as::<_, ChatMessage>(
                    r#"SELECT * FROM chat_messages
                       WHERE room_id = $1 AND created_at < $2
                       ORDER BY created_at DESC
                       LIMIT $3"#,
                )
                .bind(room_id)
                .bind(ct)
                .bind(limit)
                .fetch_all(&state.db)
                .await?
            }
            None => {
                sqlx::query_as::<_, ChatMessage>(
                    r#"SELECT * FROM chat_messages
                       WHERE room_id = $1
                       ORDER BY created_at DESC
                       LIMIT $2"#,
                )
                .bind(room_id)
                .bind(limit)
                .fetch_all(&state.db)
                .await?
            }
        }
    } else {
        sqlx::query_as::<_, ChatMessage>(
            r#"SELECT * FROM chat_messages
               WHERE room_id = $1
               ORDER BY created_at DESC
               LIMIT $2"#,
        )
        .bind(room_id)
        .bind(limit)
        .fetch_all(&state.db)
        .await?
    };

    let has_more = messages.len() as i64 == limit;

    Ok(Json(serde_json::json!({
        "data": messages,
        "has_more": has_more
    })))
}

/// PUT /chat/rooms/:id/read — Mark all messages in room as read
async fn mark_read(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify user is participant
    let is_participant = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2))",
    )
    .bind(room_id)
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if !is_participant {
        return Err(AppError::Forbidden(
            "Not a participant of this chat room".into(),
        ));
    }

    let result = sqlx::query(
        "UPDATE chat_messages SET is_read = true WHERE room_id = $1 AND sender_id != $2 AND is_read = false",
    )
    .bind(room_id)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": {
            "updated": result.rows_affected()
        }
    })))
}

/// FR-18: 채팅 내 이미지 전송
async fn send_image_message(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
    Json(req): Json<ImageMessageRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify participant
    let is_participant = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2))",
    )
    .bind(room_id)
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if !is_participant {
        return Err(AppError::Forbidden(
            "Not a participant of this chat room".into(),
        ));
    }

    // Validate image_url (basic check)
    if req.image_url.is_empty() || req.image_url.len() > 2000 {
        return Err(AppError::Validation {
            message: "Invalid image URL".into(),
            field: Some("image_url".into()),
        });
    }

    let msg_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO chat_messages (id, room_id, sender_id, content, message_type, image_url, image_thumbnail)
           VALUES ($1, $2, $3, $4, 'image', $5, $6)"#,
    )
    .bind(msg_id)
    .bind(room_id)
    .bind(auth.id)
    .bind("[이미지]")
    .bind(&req.image_url)
    .bind(&req.thumbnail_url)
    .execute(&state.db)
    .await?;

    // Update room last_message_at
    sqlx::query("UPDATE chat_rooms SET last_message_at = NOW() WHERE id = $1")
        .bind(room_id)
        .execute(&state.db)
        .await?;

    // WebSocket broadcast
    let ws_msg = serde_json::json!({
        "type": "chat_message",
        "data": {
            "id": msg_id,
            "room_id": room_id,
            "sender_id": auth.id,
            "content": "[이미지]",
            "message_type": "image",
            "image_url": req.image_url,
            "image_thumbnail": req.thumbnail_url,
        }
    });
    let ws_str = serde_json::to_string(&ws_msg).unwrap_or_default();
    state.ws_hub.send_to_room(room_id, auth.id, &ws_str).await;

    Ok(Json(serde_json::json!({
        "data": {
            "id": msg_id,
            "room_id": room_id,
            "message_type": "image",
            "image_url": req.image_url,
        }
    })))
}

/// FR-19: 채팅 메시지 검색
async fn search_messages(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
    Query(params): Query<SearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify participant
    let is_participant = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2))",
    )
    .bind(room_id)
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if !is_participant {
        return Err(AppError::Forbidden(
            "Not a participant of this chat room".into(),
        ));
    }

    let q = params.q.as_deref().unwrap_or("");
    if q.is_empty() || q.len() > 100 {
        return Err(AppError::Validation {
            message: "Search query must be 1-100 characters".into(),
            field: Some("q".into()),
        });
    }

    let limit = params.limit.unwrap_or(20).min(50) as i64;
    let page = params.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * limit;

    let escaped_q = crate::api::admin::escape_like(q);

    let messages = sqlx::query_as::<_, ChatMessage>(
        r#"SELECT id, room_id, sender_id, content, is_read, created_at, message_type, image_url, image_thumbnail
           FROM chat_messages
           WHERE room_id = $1 AND content ILIKE '%' || $2 || '%'
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(room_id)
    .bind(&escaped_q)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM chat_messages WHERE room_id = $1 AND content ILIKE '%' || $2 || '%'",
    )
    .bind(room_id)
    .bind(&escaped_q)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": messages,
        "pagination": {
            "page": page,
            "per_page": limit,
            "total": total,
        }
    })))
}

/// FR-21: 전체 읽지 않은 메시지 수
async fn get_total_unread_count(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM chat_messages cm
           JOIN chat_rooms cr ON cr.id = cm.room_id
           WHERE (cr.buyer_id = $1 OR cr.seller_id = $1)
             AND cm.sender_id != $1
             AND cm.is_read = FALSE"#,
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": { "unread_count": count }
    })))
}
