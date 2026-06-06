use axum::{
    extract::{Multipart, Path, Query, State},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use bigdecimal::BigDecimal;
use std::str::FromStr;
use uuid::Uuid;

use axum::extract::ConnectInfo;
use std::net::SocketAddr;

use crate::domain::common::{AutocompleteParams, ProductSearchParams};
use crate::domain::product::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Products router — auth is checked inline for write operations.
/// GET endpoints are public, POST/PUT/DELETE require auth (checked in handler).
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_products))
        .route("/", post(create_product))
        .route("/search/autocomplete", get(autocomplete))
        .route("/{id}", get(get_product))
        .route("/{id}", put(update_product))
        .route("/{id}", delete(delete_product))
        .route("/{id}/images", post(upload_images))
        .route("/{id}/related", get(get_related_products))
}

async fn list_products(
    State(state): State<AppState>,
    Query(params): Query<ProductSearchParams>,
) -> Result<Json<ProductListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let sort = params.sort_column();

    // Cacheable: popular/latest without search filters
    let is_cacheable = (sort == "popular" || sort == "latest")
        && params.q.is_none()
        && params.category_id.is_none()
        && params.min_price.is_none()
        && params.max_price.is_none()
        && params.seller_grade.is_none()
        && params.free_shipping.is_none()
        && params.condition.is_none()
        && params.in_stock.is_none()
        && params.min_rating.is_none();

    if is_cacheable {
        let cache_key = format!("products:{}:{}:{}", sort, page, per_page);
        let db = state.db.clone();
        let sort_clone = sort.to_string();
        let result = state
            .cache
            .get_or_set(&cache_key, 300, || async move {
                fetch_product_list(
                    &db,
                    &sort_clone,
                    page,
                    per_page,
                    0,
                    &None,
                    None,
                    None,
                    None,
                    &None,
                    None,
                    &None,
                    None,
                    None,
                )
                .await
            })
            .await;
        if let Ok(response) = result {
            return Ok(Json(response));
        }
    }

    fetch_product_list_handler(&state, &params, sort, page, per_page, offset).await
}

async fn fetch_product_list_handler(
    state: &AppState,
    params: &ProductSearchParams,
    sort: &str,
    page: i64,
    per_page: i64,
    offset: i64,
) -> Result<Json<ProductListResponse>, AppError> {
    fetch_product_list(
        &state.db,
        sort,
        page,
        per_page,
        offset,
        &params.q,
        params.category_id,
        params.min_price.clone(),
        params.max_price.clone(),
        &params.seller_grade,
        params.free_shipping,
        &params.condition,
        params.in_stock,
        params.min_rating,
    )
    .await
    .map(Json)
    .map_err(AppError::Internal)
}

// 검색 + 카테고리 + 가격 + 5종 boolean 필터 + sort + 페이지네이션 = 14개 인자.
// 구조체로 묶을 수 있지만 호출 측 (라우트 핸들러) 가 query string 을 그대로
// 펼쳐 전달하는 흐름이 더 명확하고, 인자 순서가 SQL 절 순서와 1:1 매칭됨.
#[allow(clippy::too_many_arguments)]
async fn fetch_product_list(
    db: &sqlx::PgPool,
    sort: &str,
    page: i64,
    per_page: i64,
    offset_val: i64,
    q: &Option<String>,
    category_id: Option<Uuid>,
    min_price: Option<BigDecimal>,
    max_price: Option<BigDecimal>,
    seller_grade: &Option<String>,
    free_shipping: Option<bool>,
    condition: &Option<String>,
    in_stock: Option<bool>,
    min_rating: Option<f64>,
) -> Result<ProductListResponse, anyhow::Error> {
    let offset = if offset_val > 0 {
        offset_val
    } else {
        (page - 1) * per_page
    };

    let order_clause = match sort {
        "price_asc" => "p.final_price ASC NULLS LAST",
        "price_desc" => "p.final_price DESC NULLS LAST",
        "popular" => "p.sold_count DESC NULLS LAST, p.created_at DESC",
        "reviews" => "p.review_count DESC NULLS LAST, p.avg_rating DESC NULLS LAST",
        "rating" => "p.avg_rating DESC NULLS LAST, p.review_count DESC NULLS LAST",
        _ => "p.created_at DESC",
    };

    // Validate condition filter value
    let condition_filter = condition.as_deref().and_then(|c| match c {
        "new" | "used" | "refurbished" => Some(c.to_string()),
        _ => None,
    });

    // FR-08: Single query with COUNT(*) OVER() instead of separate COUNT + SELECT
    let query = format!(
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
           LEFT JOIN seller_grades sg ON sg.seller_id = sp.id
           WHERE p.status = 'active'
             AND ($1::text IS NULL OR to_tsvector('simple', p.title || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('simple', $1))
             AND ($2::uuid IS NULL OR p.category_id = $2)
             AND ($3::numeric IS NULL OR p.final_price >= $3::numeric)
             AND ($4::numeric IS NULL OR p.final_price <= $4::numeric)
             AND ($5::text IS NULL OR COALESCE(sg.grade, 'bronze') = $5)
             AND ($6::bool IS NULL OR ($6 = true AND p.shipping_fee = 0))
             AND ($7::text IS NULL OR p.condition = $7)
             AND ($8::bool IS NULL OR ($8 = true AND p.stock > 0))
             AND ($9::float8 IS NULL OR COALESCE(p.avg_rating, 0) >= $9::float8)
           ORDER BY {}
           LIMIT $10 OFFSET $11"#,
        order_clause
    );

    let products = sqlx::query_as::<_, ProductSummary>(&query)
        .bind(q)
        .bind(category_id)
        .bind(min_price)
        .bind(max_price)
        .bind(seller_grade)
        .bind(free_shipping)
        .bind(&condition_filter)
        .bind(in_stock)
        .bind(min_rating)
        .bind(per_page)
        .bind(offset)
        .fetch_all(db)
        .await
        .map_err(anyhow::Error::from)?;

    // Extract total from first row's window function, or 0 if empty
    let total = products.first().and_then(|p| p.total_count).unwrap_or(0);

    Ok(ProductListResponse {
        data: products,
        pagination: crate::domain::common::Pagination::new(page, per_page, total),
    })
}

async fn get_product(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(id): Path<Uuid>,
    auth: Option<Extension<AuthUser>>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-01: Product + Seller single JOIN query (1 round-trip instead of 2)
    let row = sqlx::query(
        r#"SELECT p.*,
                  COALESCE(u.nickname, u.username) AS seller_nickname,
                  sp.avg_rating AS seller_avg_rating
           FROM products p
           LEFT JOIN seller_profiles sp ON sp.id = p.seller_id
           LEFT JOIN users u ON u.id = sp.user_id
           WHERE p.id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Product not found".into()))?;

    use sqlx::Row;
    let product = Product {
        id: row.get("id"),
        seller_id: row.get("seller_id"),
        category_id: row.get("category_id"),
        title: row.get("title"),
        description: row.get("description"),
        base_price: row.get("base_price"),
        margin_rate: row.get("margin_rate"),
        commission_rate: row.get("commission_rate"),
        final_price: row.get("final_price"),
        shipping_fee: row.get("shipping_fee"),
        stock: row.get("stock"),
        sold_count: row.get("sold_count"),
        view_count: row.get("view_count"),
        wishlist_count: row.get("wishlist_count"),
        avg_rating: row.get("avg_rating"),
        review_count: row.get("review_count"),
        return_policy: row.get("return_policy"),
        status: row.get("status"),
        rejected_reason: row.get("rejected_reason"),
        approved_at: row.get("approved_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        // Phase A: Korean marketplace enhancement
        kc_certification: row.try_get("kc_certification").unwrap_or(None),
        manufacturer: row.try_get("manufacturer").unwrap_or(None),
        origin_country: row.try_get("origin_country").unwrap_or(None),
        condition: row.try_get("condition").unwrap_or(None),
        is_draft: row.try_get("is_draft").unwrap_or(None),
        scheduled_at: row.try_get("scheduled_at").unwrap_or(None),
    };

    let seller_name: String = row.try_get("seller_nickname").unwrap_or("Unknown".into());
    let seller_rating: Option<BigDecimal> = row.try_get("seller_avg_rating").unwrap_or(None);

    // FR-17: IP-based view count dedup via Redis (15min window) — fire-and-forget, non-blocking
    let ip = addr.ip().to_string();
    let view_key = format!("view:{}:{}", id, ip);
    if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
        let set: Result<bool, _> = redis::cmd("SET")
            .arg(&view_key)
            .arg("1")
            .arg("NX")
            .arg("EX")
            .arg(900_u32)
            .query_async(&mut conn)
            .await;
        if set.unwrap_or(false) {
            let _ = sqlx::query(
                "UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1",
            )
            .bind(id)
            .execute(&state.db)
            .await;
        }
    }

    // FR-01: Images + Options concurrently (was sequential)
    let (images, options) = tokio::try_join!(
        sqlx::query_as::<_, ProductImage>(
            "SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order",
        )
        .bind(id)
        .fetch_all(&state.db),
        sqlx::query_as::<_, ProductOption>(
            "SELECT * FROM product_options WHERE product_id = $1 ORDER BY sort_order",
        )
        .bind(id)
        .fetch_all(&state.db),
    )?;

    // Check wishlist (conditional — keep separate)
    let is_wishlisted = if let Some(Extension(user)) = auth {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM wishlist WHERE user_id = $1 AND product_id = $2)",
        )
        .bind(user.id)
        .bind(id)
        .fetch_one(&state.db)
        .await?
    } else {
        false
    };

    // FR-02: Build category breadcrumb using WITH RECURSIVE CTE (replaces full table scan)
    let category_breadcrumb = {
        let breadcrumb_rows = sqlx::query_as::<_, (Uuid, String, String, Option<Uuid>, i32, bool)>(
            r#"WITH RECURSIVE ancestors AS (
                SELECT id, name, slug, parent_id, 0 AS depth, is_digital
                FROM categories WHERE id = $1 AND is_active = true
                UNION ALL
                SELECT c.id, c.name, c.slug, c.parent_id, a.depth + 1, c.is_digital
                FROM categories c
                JOIN ancestors a ON c.id = a.parent_id
                WHERE c.is_active = true
            )
            SELECT id, name, slug, parent_id, depth, is_digital FROM ancestors ORDER BY depth DESC"#,
        )
        .bind(product.category_id)
        .fetch_all(&state.db)
        .await?;

        if breadcrumb_rows.is_empty() {
            None
        } else {
            let mut current: Option<crate::domain::category::CategoryBreadcrumb> = None;
            for row in breadcrumb_rows.iter().rev() {
                current = Some(crate::domain::category::CategoryBreadcrumb {
                    id: row.0,
                    name: row.1.clone(),
                    slug: row.2.clone(),
                    is_digital: row.5,
                    parent: current.map(Box::new),
                });
            }
            current
        }
    };

    let detail = ProductDetail {
        id: product.id,
        seller_id: product.seller_id,
        seller_name,
        seller_rating,
        category: category_breadcrumb,
        title: product.title,
        description: product.description,
        base_price: product.base_price,
        margin_rate: product.margin_rate,
        commission_rate: product.commission_rate,
        final_price: product.final_price,
        shipping_fee: product.shipping_fee,
        stock: product.stock,
        sold_count: product.sold_count.unwrap_or(0),
        view_count: product.view_count.unwrap_or(0),
        wishlist_count: product.wishlist_count.unwrap_or(0),
        avg_rating: product.avg_rating,
        review_count: product.review_count.unwrap_or(0),
        return_policy: product.return_policy,
        status: product.status.unwrap_or_else(|| "active".into()),
        images,
        options,
        is_wishlisted,
        created_at: product.created_at,
        // Phase A: Korean marketplace enhancement
        manufacturer: product.manufacturer,
        origin_country: product.origin_country,
        condition: product.condition,
        kc_certification: product.kc_certification,
        is_draft: product.is_draft,
    };

    Ok(Json(serde_json::json!({ "data": detail })))
}

async fn create_product(
    State(state): State<AppState>,
    auth_ext: Option<Extension<AuthUser>>,
    Json(req): Json<CreateProductRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let auth = auth_ext
        .ok_or_else(|| AppError::Unauthorized("Authentication required".into()))?
        .0;

    // FR-20: User-keyed rate limit (10/min per user)
    crate::middleware::rate_limit::check_user_rate_limit(
        &state.user_rate_limiters.product_write,
        auth.id,
    )?;

    // Check seller role
    if auth.role != crate::domain::user::UserRole::Seller {
        return Err(AppError::Forbidden("Seller role required".into()));
    }

    let seller = sqlx::query_as::<_, crate::domain::seller::SellerProfile>(
        "SELECT * FROM seller_profiles WHERE user_id = $1 AND status = 'approved'",
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Forbidden("Seller not approved".into()))?;

    // Validate
    if req.title.is_empty() || req.title.chars().count() > 200 {
        return Err(AppError::Validation {
            message: "Title must be 1-200 characters".into(),
            field: Some("title".into()),
        });
    }

    // v1.3.4: 마진 0% 허용 (NFT/무마진 상품 대응). 상한은 셀러 자율 100% 까지.
    let min_margin = BigDecimal::from(0);
    let max_margin = BigDecimal::from(100);
    if req.margin_rate < min_margin || req.margin_rate > max_margin {
        return Err(AppError::Validation {
            message: "Margin rate must be between 0 and 100".into(),
            field: Some("margin_rate".into()),
        });
    }

    let zero = BigDecimal::from(0);
    if req.base_price <= zero {
        return Err(AppError::Validation {
            message: "Base price must be greater than 0".into(),
            field: Some("base_price".into()),
        });
    }

    // FR-23: stock 음수 검증
    if req.stock < 0 {
        return Err(AppError::Validation {
            message: "Stock cannot be negative".into(),
            field: Some("stock".into()),
        });
    }

    // FR-23: 옵션 stock 음수 검증
    if let Some(ref options) = req.options {
        for opt in options {
            if opt.stock < 0 {
                return Err(AppError::Validation {
                    message: "Option stock cannot be negative".into(),
                    field: Some("options.stock".into()),
                });
            }
        }
    }

    let product_id = Uuid::new_v4();
    let shipping = req
        .shipping_fee
        .clone()
        .unwrap_or_else(|| BigDecimal::from(0));

    // Fetch commission_rate from the selected category
    let commission_rate =
        sqlx::query_scalar::<_, BigDecimal>("SELECT commission_rate FROM categories WHERE id = $1")
            .bind(req.category_id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or_else(|| BigDecimal::from_str("5.0").unwrap());

    // FR-14: 트랜잭션으로 상품 + 옵션 INSERT 원자적 처리
    let mut tx = state.db.begin().await?;

    sqlx::query(
        r#"INSERT INTO products (id, seller_id, category_id, title, description, base_price, margin_rate, commission_rate, shipping_fee, stock, return_policy, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')"#,
    )
    .bind(product_id)
    .bind(seller.id)
    .bind(req.category_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.base_price)
    .bind(&req.margin_rate)
    .bind(&commission_rate)
    .bind(&shipping)
    .bind(req.stock)
    .bind(&req.return_policy)
    .execute(&mut *tx)
    .await?;

    // Insert options if any
    if let Some(options) = &req.options {
        for (i, opt) in options.iter().enumerate() {
            sqlx::query(
                r#"INSERT INTO product_options (id, product_id, option_name, option_value, additional_price, stock, sort_order)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
            )
            .bind(Uuid::new_v4())
            .bind(product_id)
            .bind(&opt.option_name)
            .bind(&opt.option_value)
            .bind(opt.additional_price.clone().unwrap_or_else(|| BigDecimal::from(0)))
            .bind(opt.stock)
            .bind(i as i16)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    // Invalidate product caches
    state.cache.invalidate_pattern("products:*").await;

    Ok(Json(serde_json::json!({ "data": { "id": product_id } })))
}

async fn update_product(
    State(state): State<AppState>,
    auth_ext: Option<Extension<AuthUser>>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProductRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let auth = auth_ext
        .ok_or_else(|| AppError::Unauthorized("Authentication required".into()))?
        .0;
    if auth.role != crate::domain::user::UserRole::Seller {
        return Err(AppError::Forbidden("Seller role required".into()));
    }

    // Verify ownership
    let product = sqlx::query_as::<_, Product>("SELECT * FROM products WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Product not found".into()))?;

    let seller = sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
        .bind(auth.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    if product.seller_id != seller {
        return Err(AppError::Forbidden("Not the product owner".into()));
    }

    // FR-06: 판매자는 status 직접 변경 불가 (admin만 가능)
    if req.status.is_some() {
        return Err(AppError::Forbidden(
            "Product status can only be changed by admin".into(),
        ));
    }

    // FR-06: CJK-safe title length check
    if let Some(ref title) = req.title {
        if title.is_empty() || title.chars().count() > 200 {
            return Err(AppError::Validation {
                message: "Title must be 1-200 characters".into(),
                field: Some("title".into()),
            });
        }
    }

    // v1.3.4: 마진 0% 허용 (NFT/무마진 상품 대응). 상한은 셀러 자율 100% 까지.
    if let Some(ref margin_rate) = req.margin_rate {
        let min_margin = BigDecimal::from(0);
        let max_margin = BigDecimal::from(100);
        if margin_rate < &min_margin || margin_rate > &max_margin {
            return Err(AppError::Validation {
                message: "Margin rate must be between 0 and 100".into(),
                field: Some("margin_rate".into()),
            });
        }
    }

    // If category changed, fetch new commission_rate
    let new_commission_rate = if let Some(cat_id) = req.category_id {
        sqlx::query_scalar::<_, BigDecimal>("SELECT commission_rate FROM categories WHERE id = $1")
            .bind(cat_id)
            .fetch_optional(&state.db)
            .await?
    } else {
        None
    };

    // Build dynamic update (status excluded — FR-06)
    sqlx::query(
        r#"UPDATE products SET
           category_id = COALESCE($2, category_id),
           title = COALESCE($3, title),
           description = COALESCE($4, description),
           base_price = COALESCE($5, base_price),
           margin_rate = COALESCE($6, margin_rate),
           shipping_fee = COALESCE($7, shipping_fee),
           stock = COALESCE($8, stock),
           return_policy = COALESCE($9, return_policy),
           commission_rate = COALESCE($10, commission_rate),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(req.category_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.base_price)
    .bind(&req.margin_rate)
    .bind(&req.shipping_fee)
    .bind(req.stock)
    .bind(&req.return_policy)
    .bind(new_commission_rate)
    .execute(&state.db)
    .await?;

    state.cache.invalidate_pattern("products:*").await;

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

async fn delete_product(
    State(state): State<AppState>,
    auth_ext: Option<Extension<AuthUser>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let auth = auth_ext
        .ok_or_else(|| AppError::Unauthorized("Authentication required".into()))?
        .0;
    if auth.role != crate::domain::user::UserRole::Seller {
        return Err(AppError::Forbidden("Seller role required".into()));
    }

    let seller = sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
        .bind(auth.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let rows = sqlx::query(
        "UPDATE products SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND seller_id = $2",
    )
    .bind(id)
    .bind(seller)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Product not found or not owner".into()));
    }

    state.cache.invalidate_pattern("products:*").await;

    Ok(Json(serde_json::json!({ "data": { "deleted": true } })))
}

async fn autocomplete(
    State(state): State<AppState>,
    Query(params): Query<AutocompleteParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let q = params.q.trim().to_string();
    if q.len() < 2 {
        return Ok(Json(serde_json::json!({ "data": [] })));
    }

    let cache_key = format!("products:search:autocomplete:{}", q);
    let db = state.db.clone();
    let q_clone = q.clone();

    // FR-04: Use prefix search for short queries, trigram for longer ones (GIN indexed)
    let results = state
        .cache
        .get_or_set(&cache_key, 180, || async move {
            let rows = if q_clone.chars().count() <= 2 {
                // Short query: prefix search (btree indexed)
                sqlx::query_scalar::<_, String>(
                    r#"SELECT DISTINCT title FROM products
                       WHERE status = 'active' AND title ILIKE $1 || '%'
                       ORDER BY title
                       LIMIT 10"#,
                )
                .bind(&q_clone)
                .fetch_all(&db)
                .await
                .map_err(anyhow::Error::from)?
            } else {
                // Longer query: trigram similarity (GIN indexed via pg_trgm)
                sqlx::query_scalar::<_, String>(
                    r#"SELECT DISTINCT title FROM products
                       WHERE status = 'active' AND title % $1
                       ORDER BY similarity(title, $1) DESC, sold_count DESC NULLS LAST
                       LIMIT 10"#,
                )
                .bind(&q_clone)
                .fetch_all(&db)
                .await
                .map_err(anyhow::Error::from)?
            };
            Ok(rows)
        })
        .await
        .unwrap_or_default();

    Ok(Json(serde_json::json!({ "data": results })))
}

async fn upload_images(
    State(state): State<AppState>,
    auth_ext: Option<Extension<AuthUser>>,
    Path(product_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    let auth = auth_ext
        .ok_or_else(|| AppError::Unauthorized("Authentication required".into()))?
        .0;
    if auth.role != crate::domain::user::UserRole::Seller {
        return Err(AppError::Forbidden("Seller role required".into()));
    }

    // Verify product ownership
    let seller = sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
        .bind(auth.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let product_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND seller_id = $2)",
    )
    .bind(product_id)
    .bind(seller)
    .fetch_one(&state.db)
    .await?;

    if !product_exists {
        return Err(AppError::NotFound("Product not found or not owner".into()));
    }

    // Check existing image count
    let existing_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM product_images WHERE product_id = $1")
            .bind(product_id)
            .fetch_one(&state.db)
            .await?;

    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".into());
    let product_dir = format!("{}/products/{}", upload_dir, product_id);
    tokio::fs::create_dir_all(&product_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create upload dir: {}", e)))?;

    let mut uploaded = Vec::new();
    let mut sort_order = existing_count as i16;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Multipart error: {}", e)))?
    {
        if sort_order >= 10 {
            break; // Max 10 images
        }

        let content_type = field.content_type().unwrap_or("").to_string();
        if !["image/jpeg", "image/png", "image/webp"].contains(&content_type.as_str()) {
            return Err(AppError::Validation {
                message: "Only JPEG, PNG, WebP images are allowed".into(),
                field: Some("images".into()),
            });
        }

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read field: {}", e)))?;

        // FR-24: 매직 바이트 검증 — slice 패턴으로 redundant guard 회피.
        let magic_valid = match data.get(..4) {
            Some([0xFF, 0xD8, 0xFF, _]) => true,    // JPEG
            Some([0x89, 0x50, 0x4E, 0x47]) => true, // PNG
            Some(b"RIFF") if data.get(8..12) == Some(b"WEBP") => true, // WebP (12바이트 컨테이너)
            _ => false,
        };
        if !magic_valid {
            return Err(AppError::Validation {
                message: "File content does not match a valid image format".into(),
                field: Some("images".into()),
            });
        }

        if data.len() > 10 * 1024 * 1024 {
            return Err(AppError::Validation {
                message: "Image size must be under 10MB".into(),
                field: Some("images".into()),
            });
        }

        let file_id = Uuid::new_v4();
        let filename = format!("{}.webp", file_id);
        let filepath = format!("{}/{}", product_dir, filename);

        // Convert to WebP using image crate
        let webp_data = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, anyhow::Error> {
            let img = image::load_from_memory(&data)?;
            // Resize if larger than 1200px on either dimension
            let img = img.resize(1200, 1200, image::imageops::FilterType::Lanczos3);
            let mut buf = std::io::Cursor::new(Vec::new());
            img.write_to(&mut buf, image::ImageFormat::WebP)?;
            Ok(buf.into_inner())
        })
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Image task failed: {}", e)))?
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Image conversion failed: {}", e)))?;

        tokio::fs::write(&filepath, &webp_data)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e)))?;

        let image_url = format!("/uploads/products/{}/{}", product_id, filename);
        let is_main = sort_order == 0;
        let image_id = Uuid::new_v4();

        sqlx::query(
            r#"INSERT INTO product_images (id, product_id, image_url, sort_order, is_main)
               VALUES ($1, $2, $3, $4, $5)"#,
        )
        .bind(image_id)
        .bind(product_id)
        .bind(&image_url)
        .bind(sort_order)
        .bind(is_main)
        .execute(&state.db)
        .await?;

        uploaded.push(serde_json::json!({
            "id": image_id,
            "image_url": image_url,
            "sort_order": sort_order,
            "is_main": is_main,
        }));

        sort_order += 1;
    }

    Ok(Json(serde_json::json!({ "data": uploaded })))
}

/// GET /products/{id}/related — related products in the same category
async fn get_related_products(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // First, get the product's category_id
    let category_id =
        sqlx::query_scalar::<_, Uuid>("SELECT category_id FROM products WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Product not found".into()))?;

    // Fetch related products in same category, excluding current, ordered by rating & sales
    let related = sqlx::query_as::<_, ProductSummary>(
        r#"SELECT p.id, p.title, p.final_price, p.shipping_fee, p.stock,
                  p.sold_count, p.wishlist_count, p.avg_rating, p.review_count, p.status, p.rejected_reason, p.created_at,
                  pi.image_url as main_image,
                  u.nickname as seller_name,
                  c.name as category_name,
                  NULL::bigint as total_count
           FROM products p
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_main = true
           JOIN seller_profiles sp ON sp.id = p.seller_id
           JOIN users u ON u.id = sp.user_id
           JOIN categories c ON c.id = p.category_id
           WHERE p.category_id = $1
             AND p.id != $2
             AND p.status = 'active'
           ORDER BY COALESCE(p.avg_rating, 0) DESC, COALESCE(p.sold_count, 0) DESC
           LIMIT 8"#,
    )
    .bind(category_id)
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": related })))
}
