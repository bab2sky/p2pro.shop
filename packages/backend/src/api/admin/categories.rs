//! Category CRUD operations

use axum::{
    extract::{ConnectInfo, Path, State},
    Extension, Json,
};
use serde_json::json;
use std::net::SocketAddr;
use uuid::Uuid;

use super::extract_ip;
use crate::domain::admin::log_admin_action;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub async fn list_categories(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let categories = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<Uuid>, i32, String, Option<String>, bool, bool, bigdecimal::BigDecimal)>(
        "SELECT id, name, name_en, parent_id, sort_order, slug, icon, is_active, is_digital, commission_rate FROM categories ORDER BY sort_order, name",
    )
    .fetch_all(&state.db)
    .await?;

    let data: Vec<serde_json::Value> = categories
        .into_iter()
        .map(|(id, name, name_en, parent_id, sort_order, slug, icon, is_active, is_digital, commission_rate)| {
            json!({ "id": id, "name": name, "name_en": name_en, "parent_id": parent_id, "sort_order": sort_order, "slug": slug, "icon": icon, "is_active": is_active, "is_digital": is_digital, "commission_rate": commission_rate })
        })
        .collect();

    Ok(Json(json!({ "data": data })))
}

#[derive(Debug, serde::Deserialize)]
pub struct CategoryRequest {
    name: String,
    name_en: Option<String>,
    parent_id: Option<Uuid>,
    sort_order: Option<i32>,
    slug: Option<String>,
    icon: Option<String>,
    commission_rate: Option<bigdecimal::BigDecimal>,
    is_digital: Option<bool>,
}

pub async fn create_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<CategoryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));
    let id = Uuid::new_v4();

    // 글로벌 진출 D-3: 신규 카테고리 추가 시 영어 이름 필수.
    let name_en = req.name_en.as_deref().unwrap_or("").trim();
    if name_en.is_empty() {
        return Err(AppError::Validation {
            message: "name_en (English name) is required for new categories".into(),
            field: Some("name_en".into()),
        });
    }

    let slug = req
        .slug
        .unwrap_or_else(|| req.name.to_lowercase().replace(' ', "-"));
    let sort_order = req.sort_order.unwrap_or(0);
    let commission_rate = req
        .commission_rate
        .unwrap_or_else(|| bigdecimal::BigDecimal::from(5));
    let is_digital = req.is_digital.unwrap_or(false);

    sqlx::query(
        "INSERT INTO categories (id, name, name_en, parent_id, sort_order, slug, icon, commission_rate, is_digital) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(id).bind(&req.name).bind(name_en).bind(req.parent_id).bind(sort_order).bind(&slug).bind(&req.icon).bind(&commission_rate).bind(is_digital)
    .execute(&state.db).await?;

    log_admin_action(
        &state.db,
        auth.id,
        "category_create",
        "category",
        id,
        Some(json!({ "name": req.name })),
        ip,
    )
    .await?;
    state.cache.invalidate("categories:tree").await;

    Ok(Json(
        json!({ "data": { "id": id, "name": req.name, "slug": slug } }),
    ))
}

pub async fn update_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<CategoryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    // 글로벌 진출 D-3: name_en 도 update (있을 때만, NULL 허용 안 함).
    let result = sqlx::query(
        "UPDATE categories SET name = $1, name_en = COALESCE($2, name_en), parent_id = $3, sort_order = COALESCE($4, sort_order), slug = COALESCE($5, slug), icon = COALESCE($6, icon), commission_rate = COALESCE($7, commission_rate), is_digital = COALESCE($9, is_digital) WHERE id = $8",
    )
    .bind(&req.name).bind(req.name_en.as_deref()).bind(req.parent_id).bind(req.sort_order).bind(&req.slug).bind(&req.icon).bind(&req.commission_rate).bind(id).bind(req.is_digital)
    .execute(&state.db).await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Category not found".into()));
    }

    log_admin_action(
        &state.db,
        auth.id,
        "category_update",
        "category",
        id,
        Some(json!({ "name": req.name })),
        ip,
    )
    .await?;
    state.cache.invalidate("categories:tree").await;

    Ok(Json(json!({ "data": { "id": id, "name": req.name } })))
}

pub async fn delete_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    // Collect this category + all descendant IDs (CASCADE will delete children)
    let descendant_ids = sqlx::query_as::<_, (Uuid,)>(
        "WITH RECURSIVE tree AS (
            SELECT id FROM categories WHERE id = $1
            UNION ALL
            SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id
        ) SELECT id FROM tree",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let ids: Vec<Uuid> = descendant_ids.into_iter().map(|(i,)| i).collect();

    // Check products referencing this category or its descendants
    let product_count =
        sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM products WHERE category_id = ANY($1)")
            .bind(&ids)
            .fetch_one(&state.db)
            .await?
            .0;

    if product_count > 0 {
        return Err(AppError::Validation {
            message: format!(
                "이 카테고리에 {}개의 상품이 등록되어 있어 삭제할 수 없습니다. 상품을 먼저 이동하거나 삭제해주세요.",
                product_count
            ),
            field: None,
        });
    }

    // Check seller profiles referencing this category
    let seller_count = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM seller_profiles WHERE main_category_id = ANY($1)",
    )
    .bind(&ids)
    .fetch_one(&state.db)
    .await?
    .0;

    if seller_count > 0 {
        return Err(AppError::Validation {
            message: format!(
                "이 카테고리를 주 카테고리로 사용하는 판매자가 {}명 있어 삭제할 수 없습니다.",
                seller_count
            ),
            field: None,
        });
    }

    let result = sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Category not found".into()));
    }

    log_admin_action(
        &state.db,
        auth.id,
        "category_delete",
        "category",
        id,
        None,
        ip,
    )
    .await?;
    state.cache.invalidate("categories:tree").await;

    Ok(Json(json!({ "data": { "id": id, "deleted": true } })))
}

#[derive(serde::Deserialize)]
pub struct ReorderItem {
    id: Uuid,
    sort_order: i32,
    parent_id: Option<Uuid>,
}

#[derive(serde::Deserialize)]
pub struct ReorderCategoriesRequest {
    items: Vec<ReorderItem>,
}

pub async fn reorder_categories(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<ReorderCategoriesRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let mut tx = state.db.begin().await?;
    for item in &req.items {
        sqlx::query(
            "UPDATE categories SET sort_order = $2, parent_id = $3, updated_at = NOW() WHERE id = $1",
        )
        .bind(item.id).bind(item.sort_order).bind(item.parent_id)
        .execute(&mut *tx).await?;
    }
    tx.commit().await?;

    log_admin_action(
        &state.db,
        auth.id,
        "category_reorder",
        "category",
        Uuid::nil(),
        Some(json!({ "count": req.items.len() })),
        ip,
    )
    .await?;
    state.cache.invalidate("categories:tree").await;

    Ok(Json(json!({ "data": { "updated": req.items.len() } })))
}

#[derive(serde::Deserialize)]
pub struct MoveCategoryRequest {
    parent_id: Option<Uuid>,
    sort_order: Option<i32>,
}

pub async fn move_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<MoveCategoryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    if req.parent_id == Some(id) {
        return Err(AppError::Validation {
            message: "Cannot move category under itself".into(),
            field: Some("parent_id".into()),
        });
    }

    let sort = req.sort_order.unwrap_or(0);
    let result = sqlx::query(
        "UPDATE categories SET parent_id = $2, sort_order = $3, updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .bind(req.parent_id)
    .bind(sort)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Category not found".into()));
    }

    log_admin_action(
        &state.db,
        auth.id,
        "category_move",
        "category",
        id,
        Some(json!({ "parent_id": req.parent_id, "sort_order": sort })),
        ip,
    )
    .await?;
    state.cache.invalidate("categories:tree").await;

    Ok(Json(
        json!({ "data": { "id": id, "parent_id": req.parent_id, "sort_order": sort } }),
    ))
}

pub async fn toggle_category_active(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query_as::<_, (bool,)>(
        "UPDATE categories SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING is_active",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    match result {
        Some((is_active,)) => {
            log_admin_action(
                &state.db,
                auth.id,
                "category_toggle_active",
                "category",
                id,
                Some(json!({ "is_active": is_active })),
                ip,
            )
            .await?;
            state.cache.invalidate("categories:tree").await;
            Ok(Json(
                json!({ "data": { "id": id, "is_active": is_active } }),
            ))
        }
        None => Err(AppError::NotFound("Category not found".into())),
    }
}
