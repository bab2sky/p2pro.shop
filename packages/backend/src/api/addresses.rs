use axum::{
    extract::{Path, State},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::domain::address::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_addresses))
        .route("/", post(create_address))
        .route("/{id}", put(update_address))
        .route("/{id}", delete(delete_address))
}

async fn list_addresses(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let addresses = sqlx::query_as::<_, Address>(
        "SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": addresses })))
}

async fn create_address(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateAddressRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Max 5 addresses
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM addresses WHERE user_id = $1")
        .bind(auth.id)
        .fetch_one(&state.db)
        .await?;

    if count >= 5 {
        return Err(AppError::Validation {
            message: "Maximum 5 addresses allowed".into(),
            field: Some("addresses".into()),
        });
    }

    let is_default = req.is_default.unwrap_or(count == 0);

    // If setting as default, unset existing default
    if is_default {
        sqlx::query("UPDATE addresses SET is_default = false WHERE user_id = $1")
            .bind(auth.id)
            .execute(&state.db)
            .await?;
    }

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO addresses (id, user_id, label, recipient_name, recipient_phone, zipcode, address1, address2, is_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
    )
    .bind(id)
    .bind(auth.id)
    .bind(&req.label)
    .bind(&req.recipient_name)
    .bind(&req.recipient_phone)
    .bind(&req.zipcode)
    .bind(&req.address1)
    .bind(&req.address2)
    .bind(is_default)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "id": id } })))
}

async fn update_address(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateAddressRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // If setting as default, unset existing default
    if req.is_default == Some(true) {
        sqlx::query("UPDATE addresses SET is_default = false WHERE user_id = $1")
            .bind(auth.id)
            .execute(&state.db)
            .await?;
    }

    let rows = sqlx::query(
        r#"UPDATE addresses SET
           label = COALESCE($3, label),
           recipient_name = COALESCE($4, recipient_name),
           recipient_phone = COALESCE($5, recipient_phone),
           zipcode = COALESCE($6, zipcode),
           address1 = COALESCE($7, address1),
           address2 = COALESCE($8, address2),
           is_default = COALESCE($9, is_default),
           updated_at = NOW()
           WHERE id = $1 AND user_id = $2"#,
    )
    .bind(id)
    .bind(auth.id)
    .bind(&req.label)
    .bind(&req.recipient_name)
    .bind(&req.recipient_phone)
    .bind(&req.zipcode)
    .bind(&req.address1)
    .bind(&req.address2)
    .bind(req.is_default)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Address not found".into()));
    }

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

async fn delete_address(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = sqlx::query("DELETE FROM addresses WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.id)
        .execute(&state.db)
        .await?
        .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Address not found".into()));
    }

    Ok(Json(serde_json::json!({ "data": { "deleted": true } })))
}
