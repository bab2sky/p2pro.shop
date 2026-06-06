use axum::{
    extract::{ConnectInfo, Path, Query, State},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use serde_json::json;
use std::net::SocketAddr;
use uuid::Uuid;

use crate::domain::admin::log_admin_action;
use crate::domain::common::{Pagination, PaginationParams};
use crate::domain::content::{CreateNoticeRequest, Notice, UpdateNoticeRequest};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

use super::admin::extract_ip;

/// Public notice routes
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_notices))
        .route("/{id}", get(get_notice))
}

/// Admin notice routes (write)
pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/notices", post(create_notice))
        .route("/notices/{id}", put(update_notice))
        .route("/notices/{id}", delete(delete_notice))
}

async fn list_notices(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM notices WHERE is_active = true")
        .fetch_one(&state.db)
        .await?;

    let notices = sqlx::query_as::<_, Notice>(
        r#"SELECT id, title, content, target, is_pinned, is_active, author_id, created_at, updated_at
           FROM notices
           WHERE is_active = true
           ORDER BY is_pinned DESC, created_at DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({
        "data": notices,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

async fn get_notice(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let notice = sqlx::query_as::<_, Notice>(
        r#"SELECT id, title, content, target, is_pinned, is_active, author_id, created_at, updated_at
           FROM notices
           WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Notice not found".into()))?;

    Ok(Json(json!({ "data": notice })))
}

async fn create_notice(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<CreateNoticeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    if req.title.is_empty() || req.content.is_empty() {
        return Err(AppError::Validation {
            message: "Title and content are required".into(),
            field: None,
        });
    }

    let id = Uuid::new_v4();
    let is_pinned = req.is_pinned.unwrap_or(false);

    sqlx::query(
        r#"INSERT INTO notices (id, title, content, is_pinned, author_id)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.content)
    .bind(is_pinned)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    log_admin_action(
        &state.db,
        auth.id,
        "notice_create",
        "notice",
        id,
        Some(json!({ "title": req.title })),
        ip,
    )
    .await?;

    Ok(Json(json!({ "data": { "id": id, "title": req.title } })))
}

async fn update_notice(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateNoticeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query(
        r#"UPDATE notices SET
             title = COALESCE($1, title),
             content = COALESCE($2, content),
             is_pinned = COALESCE($3, is_pinned),
             is_active = COALESCE($4, is_active),
             updated_at = NOW()
           WHERE id = $5"#,
    )
    .bind(&req.title)
    .bind(&req.content)
    .bind(req.is_pinned)
    .bind(req.is_active)
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Notice not found".into()));
    }

    log_admin_action(&state.db, auth.id, "notice_update", "notice", id, None, ip).await?;

    Ok(Json(json!({ "data": { "id": id, "updated": true } })))
}

async fn delete_notice(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query("DELETE FROM notices WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Notice not found".into()));
    }

    log_admin_action(&state.db, auth.id, "notice_delete", "notice", id, None, ip).await?;

    Ok(Json(json!({ "data": { "id": id, "deleted": true } })))
}
