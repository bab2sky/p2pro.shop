use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::domain::common::PaginationParams;
use crate::domain::product::{ProductListResponse, ProductSummary};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_wishlist))
        .route("/{product_id}", post(toggle_wishlist))
}

async fn toggle_wishlist(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check product exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND status = 'active')",
    )
    .bind(product_id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(AppError::NotFound("Product not found".into()));
    }

    // FR-22: 트랜잭션으로 찜 토글 원자적 처리 (카운트 드리프트 방지)
    let mut tx = state.db.begin().await?;

    let result = sqlx::query(
        r#"INSERT INTO wishlist (id, user_id, product_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, product_id) DO NOTHING"#,
    )
    .bind(Uuid::new_v4())
    .bind(auth.id)
    .bind(product_id)
    .execute(&mut *tx)
    .await?;

    let wishlisted = if result.rows_affected() > 0 {
        // Inserted → now wishlisted
        sqlx::query(
            "UPDATE products SET wishlist_count = COALESCE(wishlist_count, 0) + 1 WHERE id = $1",
        )
        .bind(product_id)
        .execute(&mut *tx)
        .await?;
        true
    } else {
        // Conflict → already existed, remove (rows_affected 체크)
        let del = sqlx::query("DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2")
            .bind(auth.id)
            .bind(product_id)
            .execute(&mut *tx)
            .await?;
        if del.rows_affected() > 0 {
            sqlx::query("UPDATE products SET wishlist_count = GREATEST(COALESCE(wishlist_count, 0) - 1, 0) WHERE id = $1")
                .bind(product_id)
                .execute(&mut *tx)
                .await?;
        }
        false
    };

    let new_count = sqlx::query_scalar::<_, i32>(
        "SELECT COALESCE(wishlist_count, 0) FROM products WHERE id = $1",
    )
    .bind(product_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "data": {
            "wishlisted": wishlisted,
            "wishlist_count": new_count,
        }
    })))
}

async fn list_wishlist(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ProductListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    // FR-08: Single query with COUNT(*) OVER()
    let products = sqlx::query_as::<_, ProductSummary>(
        r#"SELECT p.id, p.title, p.final_price, p.shipping_fee, p.stock,
                  p.sold_count, p.wishlist_count, p.avg_rating, p.review_count, p.status, p.rejected_reason, p.created_at,
                  pi.image_url as main_image,
                  u.nickname as seller_name,
                  c.name as category_name,
                  COUNT(*) OVER() as total_count
           FROM wishlist w
           JOIN products p ON p.id = w.product_id
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_main = true
           JOIN seller_profiles sp ON sp.id = p.seller_id
           JOIN users u ON u.id = sp.user_id
           JOIN categories c ON c.id = p.category_id
           WHERE w.user_id = $1 AND p.status = 'active'
           ORDER BY w.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = products.first().and_then(|p| p.total_count).unwrap_or(0);

    Ok(Json(ProductListResponse {
        data: products,
        pagination: crate::domain::common::Pagination::new(page, per_page, total),
    }))
}
