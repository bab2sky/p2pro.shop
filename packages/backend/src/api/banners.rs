use axum::{
    extract::{ConnectInfo, Path, State},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use serde_json::json;
use std::net::SocketAddr;
use uuid::Uuid;

use crate::domain::admin::log_admin_action;
use crate::domain::content::{Banner, CreateBannerRequest, UpdateBannerRequest};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

use super::admin::extract_ip;

/// Public banner routes
pub fn public_router() -> Router<AppState> {
    Router::new().route("/", get(list_banners))
}

/// Admin banner routes (write)
pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/banners", post(create_banner))
        .route("/banners/{id}", put(update_banner))
        .route("/banners/{id}", delete(delete_banner))
}

async fn list_banners(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    let banners = sqlx::query_as::<_, Banner>(
        r#"SELECT id, title, image_url, link_url, position, sort_order, is_active,
                  starts_at, ends_at, created_at, updated_at
           FROM banners
           WHERE is_active = true
             AND (starts_at IS NULL OR starts_at <= NOW())
             AND (ends_at IS NULL OR ends_at >= NOW())
           ORDER BY sort_order ASC, created_at DESC"#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "data": banners })))
}

async fn create_banner(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<CreateBannerRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    if req.title.is_empty() || req.image_url.is_empty() {
        return Err(AppError::Validation {
            message: "Title and image_url are required".into(),
            field: None,
        });
    }

    let id = Uuid::new_v4();
    let sort_order = req.sort_order.unwrap_or(0);

    let starts_at = req
        .starts_at
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    let ends_at = req
        .ends_at
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    sqlx::query(
        r#"INSERT INTO banners (id, title, image_url, link_url, sort_order, starts_at, ends_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.image_url)
    .bind(&req.link_url)
    .bind(sort_order)
    .bind(starts_at)
    .bind(ends_at)
    .execute(&state.db)
    .await?;

    log_admin_action(
        &state.db,
        auth.id,
        "banner_create",
        "banner",
        id,
        Some(json!({ "title": req.title })),
        ip,
    )
    .await?;

    Ok(Json(json!({ "data": { "id": id, "title": req.title } })))
}

async fn update_banner(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateBannerRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let starts_at = req
        .starts_at
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    let ends_at = req
        .ends_at
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    let result = sqlx::query(
        r#"UPDATE banners SET
             title = COALESCE($1, title),
             image_url = COALESCE($2, image_url),
             link_url = COALESCE($3, link_url),
             sort_order = COALESCE($4, sort_order),
             is_active = COALESCE($5, is_active),
             starts_at = COALESCE($6, starts_at),
             ends_at = COALESCE($7, ends_at),
             updated_at = NOW()
           WHERE id = $8"#,
    )
    .bind(&req.title)
    .bind(&req.image_url)
    .bind(&req.link_url)
    .bind(req.sort_order)
    .bind(req.is_active)
    .bind(starts_at)
    .bind(ends_at)
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Banner not found".into()));
    }

    log_admin_action(&state.db, auth.id, "banner_update", "banner", id, None, ip).await?;

    Ok(Json(json!({ "data": { "id": id, "updated": true } })))
}

async fn delete_banner(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query("DELETE FROM banners WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Banner not found".into()));
    }

    log_admin_action(&state.db, auth.id, "banner_delete", "banner", id, None, ip).await?;

    Ok(Json(json!({ "data": { "id": id, "deleted": true } })))
}
