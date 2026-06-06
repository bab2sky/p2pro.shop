use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::domain::category::{build_category_tree, Category};
use crate::domain::common::PaginationParams;
use crate::domain::product::{ProductListResponse, ProductSummary};
use crate::{AppError, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_categories))
        .route("/{id}/products", get(category_products))
}

async fn list_categories(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let db = state.db.clone();
    let tree = state
        .cache
        .get_or_set("categories:tree", 3600, || async move {
            let categories = sqlx::query_as::<_, Category>(
                "SELECT * FROM categories WHERE is_active = true ORDER BY depth, sort_order, name",
            )
            .fetch_all(&db)
            .await
            .map_err(anyhow::Error::from)?;

            // FR-06: Product count per category (including subcategories) via recursive CTE
            let counts = sqlx::query_as::<_, (Uuid, i64)>(
                r#"WITH RECURSIVE category_tree AS (
                    SELECT id, id AS root_id FROM categories WHERE is_active = true
                    UNION ALL
                    SELECT c.id, ct.root_id
                    FROM categories c
                    JOIN category_tree ct ON c.parent_id = ct.id
                    WHERE c.is_active = true
                )
                SELECT ct.root_id AS category_id, COUNT(p.id) AS product_count
                FROM category_tree ct
                LEFT JOIN products p ON p.category_id = ct.id AND p.status = 'active'
                GROUP BY ct.root_id"#,
            )
            .fetch_all(&db)
            .await
            .map_err(anyhow::Error::from)?;

            let count_map: std::collections::HashMap<Uuid, i64> = counts.into_iter().collect();
            let mut tree = build_category_tree(categories);

            // Attach counts to tree nodes recursively
            fn attach_counts(
                nodes: &mut [crate::domain::category::CategoryTree],
                map: &std::collections::HashMap<Uuid, i64>,
            ) {
                for node in nodes.iter_mut() {
                    node.product_count = map.get(&node.id).copied();
                    attach_counts(&mut node.children, map);
                }
            }
            attach_counts(&mut tree, &count_map);

            Ok(tree)
        })
        .await
        .map_err(AppError::Internal)?;

    Ok(Json(serde_json::json!({ "data": tree })))
}

async fn category_products(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
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
           FROM products p
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_main = true
           JOIN seller_profiles sp ON sp.id = p.seller_id
           JOIN users u ON u.id = sp.user_id
           JOIN categories c ON c.id = p.category_id
           WHERE p.category_id = $1 AND p.status = 'active'
           ORDER BY p.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(id)
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
