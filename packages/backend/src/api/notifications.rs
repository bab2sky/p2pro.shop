use axum::{
    extract::{Path, Query, State},
    routing::{get, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::domain::common::{Pagination, PaginationParams};
use crate::domain::notification::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_notifications))
        .route("/unread-count", get(unread_count))
        .route("/{id}/read", put(mark_read))
        .route("/read-all", put(mark_all_read))
}

async fn list_notifications(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<NotificationListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM notifications WHERE user_id = $1")
            .bind(auth.id)
            .fetch_one(&state.db)
            .await?;

    let notifications = sqlx::query_as::<_, Notification>(
        r#"SELECT id, user_id, type, title, content, link, is_read, created_at
           FROM notifications
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(NotificationListResponse {
        data: notifications,
        pagination: Pagination::new(page, per_page, total),
    }))
}

async fn unread_count(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(UnreadCountResponse {
        data: UnreadCount { count },
    }))
}

async fn mark_read(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result =
        sqlx::query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(auth.id)
            .execute(&state.db)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Notification not found".into()));
    }

    Ok(Json(
        serde_json::json!({ "data": { "id": id, "is_read": true } }),
    ))
}

async fn mark_all_read(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query(
        "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
    )
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": { "updated": result.rows_affected() }
    })))
}
