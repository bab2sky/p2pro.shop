use axum::{
    extract::{ConnectInfo, Path, Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use serde_json::json;
use std::net::SocketAddr;
use uuid::Uuid;

use crate::domain::admin::log_admin_action;
use crate::domain::content::{CreateFaqRequest, Faq, FaqQueryParams, UpdateFaqRequest};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

use super::admin::extract_ip;

/// Public FAQ routes
pub fn public_router() -> Router<AppState> {
    Router::new().route("/", get(list_faqs))
}

/// Admin FAQ routes (write)
pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/faq", post(create_faq))
        .route(
            "/faq/categories",
            get(list_faq_categories).post(add_faq_category),
        )
        .route(
            "/faq/categories/{name}",
            put(rename_faq_category).delete(delete_faq_category),
        )
        .route("/faq/{id}", put(update_faq).delete(delete_faq))
}

async fn list_faqs(
    State(state): State<AppState>,
    Query(params): Query<FaqQueryParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let faqs = if let Some(ref category) = params.category {
        sqlx::query_as::<_, Faq>(
            r#"SELECT id, category, question, answer, sort_order, is_active, created_at, updated_at
               FROM faqs
               WHERE is_active = true AND category = $1
               ORDER BY sort_order ASC, created_at DESC"#,
        )
        .bind(category)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, Faq>(
            r#"SELECT id, category, question, answer, sort_order, is_active, created_at, updated_at
               FROM faqs
               WHERE is_active = true
               ORDER BY category ASC, sort_order ASC, created_at DESC"#,
        )
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(json!({ "data": faqs })))
}

async fn create_faq(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<CreateFaqRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    if req.question.is_empty() || req.answer.is_empty() {
        return Err(AppError::Validation {
            message: "Question and answer are required".into(),
            field: None,
        });
    }

    let id = Uuid::new_v4();
    let category = req.category.as_deref().unwrap_or("general");
    let sort_order = req.sort_order.unwrap_or(0);

    sqlx::query(
        r#"INSERT INTO faqs (id, category, question, answer, sort_order)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(id)
    .bind(category)
    .bind(&req.question)
    .bind(&req.answer)
    .bind(sort_order)
    .execute(&state.db)
    .await?;

    log_admin_action(
        &state.db,
        auth.id,
        "faq_create",
        "faq",
        id,
        Some(json!({ "question": req.question })),
        ip,
    )
    .await?;

    Ok(Json(
        json!({ "data": { "id": id, "question": req.question } }),
    ))
}

async fn update_faq(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateFaqRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query(
        r#"UPDATE faqs SET
             category = COALESCE($1, category),
             question = COALESCE($2, question),
             answer = COALESCE($3, answer),
             sort_order = COALESCE($4, sort_order),
             is_active = COALESCE($5, is_active),
             updated_at = NOW()
           WHERE id = $6"#,
    )
    .bind(&req.category)
    .bind(&req.question)
    .bind(&req.answer)
    .bind(req.sort_order)
    .bind(req.is_active)
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("FAQ not found".into()));
    }

    log_admin_action(&state.db, auth.id, "faq_update", "faq", id, None, ip).await?;

    Ok(Json(json!({ "data": { "id": id, "updated": true } })))
}

async fn delete_faq(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query("DELETE FROM faqs WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("FAQ not found".into()));
    }

    log_admin_action(&state.db, auth.id, "faq_delete", "faq", id, None, ip).await?;

    Ok(Json(json!({ "data": { "id": id, "deleted": true } })))
}

// --- FAQ Category Management ---

const DEFAULT_FAQ_CATEGORIES: &[&str] = &[
    "general", "payment", "shipping", "returns", "account", "seller",
];

async fn get_faq_categories_from_settings(db: &sqlx::PgPool) -> Vec<String> {
    let stored = sqlx::query_scalar::<_, String>(
        "SELECT value FROM system_settings WHERE key = 'faq_categories'",
    )
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    if let Some(json_str) = stored {
        serde_json::from_str::<Vec<String>>(&json_str).unwrap_or_else(|_| {
            DEFAULT_FAQ_CATEGORIES
                .iter()
                .map(|s| s.to_string())
                .collect()
        })
    } else {
        DEFAULT_FAQ_CATEGORIES
            .iter()
            .map(|s| s.to_string())
            .collect()
    }
}

async fn save_faq_categories(db: &sqlx::PgPool, categories: &[String]) -> Result<(), sqlx::Error> {
    let json_str = serde_json::to_string(categories).unwrap_or_default();
    sqlx::query(
        r#"INSERT INTO system_settings (key, value, updated_at)
           VALUES ('faq_categories', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()"#,
    )
    .bind(&json_str)
    .execute(db)
    .await?;
    Ok(())
}

async fn list_faq_categories(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let categories = get_faq_categories_from_settings(&state.db).await;

    // Also get FAQ count per category
    let counts = sqlx::query_as::<_, (String, i64)>(
        "SELECT category, COUNT(*) as cnt FROM faqs GROUP BY category",
    )
    .fetch_all(&state.db)
    .await?;

    let count_map: std::collections::HashMap<String, i64> = counts.into_iter().collect();

    let data: Vec<serde_json::Value> = categories
        .iter()
        .map(|cat| {
            json!({
                "name": cat,
                "faq_count": count_map.get(cat).copied().unwrap_or(0),
            })
        })
        .collect();

    Ok(Json(json!({ "data": data })))
}

#[derive(serde::Deserialize)]
struct AddCategoryRequest {
    name: String,
}

async fn add_faq_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<AddCategoryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));
    let name = req.name.trim().to_string();

    if name.is_empty() {
        return Err(AppError::Validation {
            message: "Category name is required".into(),
            field: Some("name".into()),
        });
    }

    let mut categories = get_faq_categories_from_settings(&state.db).await;
    if categories.iter().any(|c| c == &name) {
        return Err(AppError::Validation {
            message: "Category already exists".into(),
            field: Some("name".into()),
        });
    }

    categories.push(name.clone());
    save_faq_categories(&state.db, &categories).await?;

    log_admin_action(
        &state.db,
        auth.id,
        "faq_category_add",
        "faq_category",
        Uuid::nil(),
        Some(json!({ "name": name })),
        ip,
    )
    .await?;

    Ok(Json(
        json!({ "data": { "name": name, "categories": categories } }),
    ))
}

#[derive(serde::Deserialize)]
struct RenameCategoryRequest {
    new_name: String,
}

async fn rename_faq_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(name): Path<String>,
    Json(req): Json<RenameCategoryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));
    let new_name = req.new_name.trim().to_string();

    if new_name.is_empty() {
        return Err(AppError::Validation {
            message: "New category name is required".into(),
            field: Some("new_name".into()),
        });
    }

    let mut categories = get_faq_categories_from_settings(&state.db).await;

    if categories.iter().any(|c| c == &new_name) {
        return Err(AppError::Validation {
            message: "Category name already exists".into(),
            field: Some("new_name".into()),
        });
    }

    // Rename in settings list
    if let Some(pos) = categories.iter().position(|c| c == &name) {
        categories[pos] = new_name.clone();
    } else {
        return Err(AppError::NotFound("Category not found".into()));
    }
    save_faq_categories(&state.db, &categories).await?;

    // Update all FAQs with old category name
    let updated =
        sqlx::query("UPDATE faqs SET category = $1, updated_at = NOW() WHERE category = $2")
            .bind(&new_name)
            .bind(&name)
            .execute(&state.db)
            .await?;

    log_admin_action(
        &state.db, auth.id, "faq_category_rename", "faq_category", Uuid::nil(),
        Some(json!({ "old_name": name, "new_name": new_name, "updated_faqs": updated.rows_affected() })), ip,
    ).await?;

    Ok(Json(
        json!({ "data": { "old_name": name, "new_name": new_name, "updated_faqs": updated.rows_affected() } }),
    ))
}

async fn delete_faq_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    // Check if any FAQs use this category
    let faq_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM faqs WHERE category = $1")
        .bind(&name)
        .fetch_one(&state.db)
        .await?;

    if faq_count > 0 {
        return Err(AppError::Validation {
            message: format!(
                "Cannot delete category with {} FAQ(s). Move or delete them first.",
                faq_count
            ),
            field: Some("name".into()),
        });
    }

    let mut categories = get_faq_categories_from_settings(&state.db).await;
    let before_len = categories.len();
    categories.retain(|c| c != &name);

    if categories.len() == before_len {
        return Err(AppError::NotFound("Category not found".into()));
    }

    save_faq_categories(&state.db, &categories).await?;

    log_admin_action(
        &state.db,
        auth.id,
        "faq_category_delete",
        "faq_category",
        Uuid::nil(),
        Some(json!({ "name": name })),
        ip,
    )
    .await?;

    Ok(Json(json!({ "data": { "name": name, "deleted": true } })))
}
