use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::review::*;
use crate::domain::search::{ReviewFilterParams, ReviewVoteRequest, ReviewVoteResponse};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Public review routes — nested under /products/{id}/reviews
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/products/{id}/reviews", get(list_reviews))
        .route("/products/{id}/reviews/stats", get(review_stats))
}

/// Protected review routes — auth required
pub fn protected_router() -> Router<AppState> {
    Router::new()
        .route("/products/{id}/reviewable-orders", get(reviewable_orders))
        .route("/reviews", post(create_review))
        .route("/reviews/{id}", put(update_review))
        .route("/reviews/{id}", delete(delete_review))
        .route("/reviews/{id}/vote", post(vote_review))
        .route("/product-options/{id}/image", put(set_option_image))
}

async fn list_reviews(
    State(state): State<AppState>,
    Path(product_id): Path<Uuid>,
    Query(params): Query<ReviewFilterParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let order_clause = params.order_clause();

    // Build WHERE clause dynamically
    let mut where_parts = vec!["r.product_id = $1".to_string()];
    let mut bind_idx = 2u32;

    if params.rating.is_some() {
        where_parts.push(format!("r.rating = ${bind_idx}"));
        bind_idx += 1;
    }
    if params.has_images == Some(true) {
        where_parts.push("r.images IS NOT NULL AND array_length(r.images, 1) > 0".to_string());
    }

    let where_clause = where_parts.join(" AND ");

    // Count query
    let count_sql = format!("SELECT COUNT(*) FROM reviews r WHERE {where_clause}");
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql).bind(product_id);
    if let Some(rating) = params.rating {
        count_q = count_q.bind(rating);
    }
    let total = count_q.fetch_one(&state.db).await?;

    // Main query with extended fields
    let select_sql = format!(
        r#"SELECT r.id, r.rating, r.content, r.images,
                  COALESCE(r.helpful_count, 0) as helpful_count,
                  COALESCE(r.unhelpful_count, 0) as unhelpful_count,
                  r.seller_reply, r.seller_replied_at,
                  r.created_at,
                  COALESCE(u.nickname, u.username) as user_nickname
           FROM reviews r
           JOIN users u ON u.id = r.buyer_id
           WHERE {where_clause}
           ORDER BY {order_clause}
           LIMIT ${} OFFSET ${}"#,
        bind_idx,
        bind_idx + 1,
    );
    let mut q = sqlx::query_as::<_, ReviewWithUserExtended>(&select_sql).bind(product_id);
    if let Some(rating) = params.rating {
        q = q.bind(rating);
    }
    q = q.bind(per_page).bind(offset);
    let reviews = q.fetch_all(&state.db).await?;

    Ok(Json(serde_json::json!({
        "data": reviews,
        "pagination": crate::domain::common::Pagination::new(page, per_page, total),
    })))
}

async fn review_stats(
    State(state): State<AppState>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query_as::<_, (Option<f64>, i64)>(
        r#"SELECT AVG(rating::float8), COUNT(*)
           FROM reviews WHERE product_id = $1"#,
    )
    .bind(product_id)
    .fetch_one(&state.db)
    .await?;

    let avg_rating = stats.0.unwrap_or(0.0);
    let total_count = stats.1;

    // Get distribution
    let dist_rows = sqlx::query_as::<_, (i16, i64)>(
        r#"SELECT rating, COUNT(*)
           FROM reviews WHERE product_id = $1
           GROUP BY rating"#,
    )
    .bind(product_id)
    .fetch_all(&state.db)
    .await?;

    let mut distribution = ReviewDistribution {
        five: 0,
        four: 0,
        three: 0,
        two: 0,
        one: 0,
    };

    for (rating, count) in dist_rows {
        match rating {
            5 => distribution.five = count,
            4 => distribution.four = count,
            3 => distribution.three = count,
            2 => distribution.two = count,
            1 => distribution.one = count,
            _ => {}
        }
    }

    Ok(Json(serde_json::json!({
        "data": ReviewStats {
            avg_rating,
            total_count,
            distribution,
        }
    })))
}

/// Returns orders for the current user that are eligible for review on this product
/// (status = 'delivered' AND is_reviewed = false)
async fn reviewable_orders(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let orders = sqlx::query_as::<_, (Uuid, String)>(
        r#"SELECT DISTINCT o.id, o.order_number
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           WHERE oi.product_id = $1
             AND o.buyer_id = $2
             AND o.status = 'delivered'
             AND COALESCE(o.is_reviewed, false) = false
           ORDER BY o.id
           LIMIT 5"#,
    )
    .bind(product_id)
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<serde_json::Value> = orders
        .into_iter()
        .map(|(id, order_number)| serde_json::json!({ "id": id, "order_number": order_number }))
        .collect();

    Ok(Json(serde_json::json!({ "data": data })))
}

#[derive(Debug, Deserialize)]
struct CreateReviewRequest {
    order_id: Uuid,
    rating: i16,
    content: Option<String>,
    images: Option<Vec<String>>,
}

async fn create_review(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateReviewRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate rating
    if req.rating < 1 || req.rating > 5 {
        return Err(AppError::Validation {
            message: "Rating must be between 1 and 5".into(),
            field: Some("rating".into()),
        });
    }

    // FR-32+FR-05: 리뷰 이미지 URL 도메인 화이트리스트 검증 (url crate로 host 정확 비교)
    let images = req.images.unwrap_or_default();
    validate_image_urls(&images)?;

    let review_id = Uuid::new_v4();

    // FR-12+FR-19: 트랜잭션 내에서 FOR UPDATE로 주문 잠금 (TOCTOU 방지)
    let mut tx = state.db.begin().await?;

    let order = sqlx::query_as::<_, (Uuid, String, bool)>(
        r#"SELECT buyer_id, status, COALESCE(is_reviewed, false)
           FROM orders WHERE id = $1 FOR UPDATE"#,
    )
    .bind(req.order_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    let (buyer_id, status, is_reviewed) = order;

    // Get product_id and seller_id from order_items (orders table does not have product_id)
    let (product_id, seller_id) = sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT oi.product_id, p.seller_id FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 LIMIT 1",
    )
    .bind(req.order_id)
    .fetch_one(&mut *tx)
    .await?;

    if buyer_id != auth.id {
        return Err(AppError::Forbidden("Not the order buyer".into()));
    }

    if status != "delivered" {
        return Err(AppError::Validation {
            message: "Order must be delivered before reviewing".into(),
            field: Some("order_id".into()),
        });
    }

    if is_reviewed {
        return Err(AppError::Conflict("Order already reviewed".into()));
    }

    sqlx::query(
        r#"INSERT INTO reviews (id, order_id, product_id, buyer_id, seller_id, rating, content, images)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(review_id)
    .bind(req.order_id)
    .bind(product_id)
    .bind(auth.id)
    .bind(seller_id)
    .bind(req.rating)
    .bind(&req.content)
    .bind(&images)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"UPDATE products SET
           avg_rating = (SELECT AVG(rating::numeric) FROM reviews WHERE product_id = $1),
           review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(product_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE orders SET is_reviewed = true, updated_at = NOW() WHERE id = $1")
        .bind(req.order_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "data": { "id": review_id } })))
}

#[derive(Debug, Deserialize)]
struct UpdateReviewRequest {
    rating: Option<i16>,
    content: Option<String>,
    images: Option<Vec<String>>,
}

async fn update_review(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(review_id): Path<Uuid>,
    Json(req): Json<UpdateReviewRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify review exists and belongs to user
    let review =
        sqlx::query_as::<_, (Uuid, Uuid)>("SELECT buyer_id, product_id FROM reviews WHERE id = $1")
            .bind(review_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Review not found".into()))?;

    let (buyer_id, product_id) = review;

    if buyer_id != auth.id {
        return Err(AppError::Forbidden("Not the review owner".into()));
    }

    if let Some(rating) = req.rating {
        if !(1..=5).contains(&rating) {
            return Err(AppError::Validation {
                message: "Rating must be between 1 and 5".into(),
                field: Some("rating".into()),
            });
        }
    }

    // FR-32+FR-05: URL 도메인 검증 (공유 함수 사용)
    let images_vec = if let Some(imgs) = req.images {
        validate_image_urls(&imgs)?;
        Some(imgs)
    } else {
        None
    };

    // FR-19: 트랜잭션으로 리뷰 수정 + 통계 갱신 원자적 처리
    let mut tx = state.db.begin().await?;

    sqlx::query(
        r#"UPDATE reviews SET
           rating = COALESCE($2, rating),
           content = COALESCE($3, content),
           images = COALESCE($4, images),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(review_id)
    .bind(req.rating)
    .bind(&req.content)
    .bind(&images_vec)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"UPDATE products SET
           avg_rating = (SELECT AVG(rating::numeric) FROM reviews WHERE product_id = $1),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(product_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

async fn delete_review(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(review_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let review = sqlx::query_as::<_, (Uuid, Uuid, Uuid)>(
        "SELECT buyer_id, product_id, order_id FROM reviews WHERE id = $1",
    )
    .bind(review_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Review not found".into()))?;

    let (buyer_id, product_id, order_id) = review;

    // Allow owner or admin
    if buyer_id != auth.id && auth.role != crate::domain::user::UserRole::Admin {
        return Err(AppError::Forbidden("Not the review owner or admin".into()));
    }

    // FR-19: 트랜잭션으로 리뷰 삭제 + 통계 갱신 + 주문 업데이트 원자적 처리
    let mut tx = state.db.begin().await?;

    sqlx::query("DELETE FROM reviews WHERE id = $1")
        .bind(review_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        r#"UPDATE products SET
           avg_rating = COALESCE((SELECT AVG(rating::numeric) FROM reviews WHERE product_id = $1), 0),
           review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(product_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE orders SET is_reviewed = false, updated_at = NOW() WHERE id = $1")
        .bind(order_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "data": { "deleted": true } })))
}

/// POST /api/reviews/{id}/vote — FR-B01 리뷰 도움됨 투표
async fn vote_review(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(review_id): Path<Uuid>,
    Json(req): Json<ReviewVoteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check review exists and get author
    let review_author = sqlx::query_scalar::<_, Uuid>("SELECT buyer_id FROM reviews WHERE id = $1")
        .bind(review_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Review not found".into()))?;

    // Prevent self-voting
    if review_author == auth.id {
        return Err(AppError::Validation {
            message: "Cannot vote on your own review".into(),
            field: Some("review_id".into()),
        });
    }

    let mut tx = state.db.begin().await?;

    // Upsert vote
    sqlx::query(
        r#"INSERT INTO review_votes (review_id, user_id, is_helpful)
           VALUES ($1, $2, $3)
           ON CONFLICT (review_id, user_id)
           DO UPDATE SET is_helpful = $3"#,
    )
    .bind(review_id)
    .bind(auth.id)
    .bind(req.is_helpful)
    .execute(&mut *tx)
    .await?;

    // Update denormalized counts
    sqlx::query(
        r#"UPDATE reviews SET
           helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND is_helpful = true),
           unhelpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND is_helpful = false),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(review_id)
    .execute(&mut *tx)
    .await?;

    let counts = sqlx::query_as::<_, (i32, i32)>(
        "SELECT COALESCE(helpful_count, 0), COALESCE(unhelpful_count, 0) FROM reviews WHERE id = $1",
    )
    .bind(review_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "data": ReviewVoteResponse {
            helpful_count: counts.0,
            unhelpful_count: counts.1,
            user_voted: true,
        }
    })))
}

/// PUT /api/product-options/{id}/image — FR-B10 옵션별 이미지 매핑
async fn set_option_image(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(option_id): Path<Uuid>,
    Json(req): Json<crate::domain::search::OptionImageRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify option exists and belongs to seller's product
    let option = sqlx::query_as::<_, (Uuid,)>(
        r#"SELECT p.seller_id
           FROM product_options po
           JOIN products p ON p.id = po.product_id
           WHERE po.id = $1"#,
    )
    .bind(option_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Product option not found".into()))?;

    if option.0 != auth.id {
        return Err(AppError::Forbidden("Not the product owner".into()));
    }

    sqlx::query("UPDATE product_options SET image_url = $2 WHERE id = $1")
        .bind(option_id)
        .bind(&req.image_url)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

/// FR-05: 이미지 URL 도메인 화이트리스트 검증 (url crate로 host 정확 비교)
fn validate_image_urls(urls: &[String]) -> Result<(), AppError> {
    let allowed_domains = [
        "cdn.p2pro.store",
        "images.p2pro.store",
        "s3.amazonaws.com",
        "storage.googleapis.com",
    ];
    for u in urls {
        let parsed = url::Url::parse(u).map_err(|_| AppError::Validation {
            message: "Invalid image URL format".into(),
            field: Some("images".into()),
        })?;
        if parsed.scheme() != "https" {
            return Err(AppError::Validation {
                message: "Image URL must use HTTPS".into(),
                field: Some("images".into()),
            });
        }
        let host = parsed.host_str().unwrap_or("");
        if !allowed_domains.contains(&host) {
            return Err(AppError::Validation {
                message: "Image URL domain not allowed".into(),
                field: Some("images".into()),
            });
        }
    }
    Ok(())
}
