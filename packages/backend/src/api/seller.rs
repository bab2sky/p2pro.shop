use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::domain::common::Pagination;
use crate::domain::product::{ProductListResponse, ProductSummary};
use crate::domain::seller::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

#[derive(Debug, Deserialize)]
pub struct SellerProductParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct SellerOrderParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SellerReviewParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SellerQnaParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub answered: Option<bool>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SellerReview {
    pub id: Uuid,
    pub product_id: Uuid,
    pub product_title: String,
    pub rating: i16,
    pub content: Option<String>,
    pub user_nickname: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub seller_reply: Option<String>,
    pub seller_replied_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SellerQna {
    pub id: Uuid,
    pub product_id: Uuid,
    pub product_title: String,
    pub user_nickname: Option<String>,
    pub question: String,
    pub answer: Option<String>,
    pub answered_at: Option<DateTime<Utc>>,
    pub is_secret: bool,
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SellerDashboardStats {
    pub total_products: i64,
    pub active_products: i64,
    pub pending_products: i64,
    pub total_orders: i64,
    pub pending_orders: i64,
    pub shipping_orders: i64,
    pub delivered_orders: i64,
    pub confirmed_orders: i64,
    pub unanswered_qna: i64,
    pub new_reviews: i64,
    pub today_sales: Option<BigDecimal>,
    pub month_sales: Option<BigDecimal>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DailySales {
    pub date: Option<chrono::NaiveDate>,
    pub order_count: Option<i64>,
    pub total_amount: Option<BigDecimal>,
}

#[derive(Debug, FromRow)]
struct ProfitAggregateRow {
    total_revenue: BigDecimal,
    total_margin: BigDecimal,
    /// v1.3.11: per-order commission (orders.commission_amount or
    /// total_amount * commission_rate / 100), settlement summary 와 같은 식.
    /// 글로벌 5% 하드코딩 fallback 제거.
    total_commission: BigDecimal,
    total_orders: i64,
    revenue_orders: i64,
    refunded_orders: i64,
    disputed_orders: i64,
    previous_revenue: BigDecimal,
}

/// Mass-assignment 방어: 요청 본문에 명시되지 않은 필드 (role, balance,
/// status 등) 가 들어오면 즉시 거부. 향후 struct 에 새 필드 추가 시 의도적
/// 검토 강제.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateProfileRequest {
    pub wallet_address: Option<String>,
    pub contact_phone: Option<String>,
    pub seller_type: Option<String>,
    pub business_name: Option<String>,
    pub business_number: Option<String>,
    pub representative_name: Option<String>,
    pub business_address: Option<String>,
    pub business_type: Option<String>,
    pub business_category: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/apply", post(apply_seller))
        .route("/profile", get(my_profile).put(update_profile))
        .route("/grade", get(my_grade))
        .route("/products", get(my_products))
        .route("/dashboard-stats", get(dashboard_stats))
        .route("/reviews", get(my_reviews))
        .route("/reviews/{review_id}/reply", post(reply_review))
        .route("/qna", get(my_qna))
        .route("/sales-stats", get(sales_stats))
        .route("/profit-analysis", get(profit_analysis))
        .route("/refunds", get(list_seller_refunds))
        .route("/refunds/{id}/respond", put(respond_to_refund))
        .route("/udg-history", get(seller_udg_history))
        .route("/deposit", post(submit_deposit))
        .route("/deposit/status", get(deposit_status))
}

#[derive(Debug, Deserialize)]
pub struct ReplyReviewRequest {
    pub reply: String,
}

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/{id}", get(public_profile))
        .route("/{id}/profile", get(public_profile))
}

async fn apply_seller(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<SellerApplyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check not already applied
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM seller_profiles WHERE user_id = $1)",
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if exists {
        return Err(AppError::Conflict(
            "Seller application already exists".into(),
        ));
    }

    // FR-07: Validate wallet address format (ERC-20 or TRC-20)
    crate::domain::wallet::validate_wallet_address(&req.wallet_address)?;

    let seller_type = match req.seller_type.as_str() {
        "individual" | "business" => &req.seller_type,
        _ => {
            return Err(AppError::Validation {
                message: "Seller type must be 'individual' or 'business'".into(),
                field: Some("seller_type".into()),
            })
        }
    };

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO seller_profiles (id, user_id, seller_type, wallet_address, contact_phone, main_category_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')"#,
    )
    .bind(id)
    .bind(auth.id)
    .bind(seller_type)
    .bind(&req.wallet_address)
    .bind(&req.contact_phone)
    .bind(req.main_category_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": {
            "id": id,
            "status": "pending",
            "message": "판매자 신청이 접수되었습니다. 관리자 승인 후 판매가 가능합니다."
        }
    })))
}

async fn my_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let profile =
        sqlx::query_as::<_, SellerProfile>("SELECT * FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    Ok(Json(serde_json::json!({ "data": profile })))
}

async fn public_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cache_key = format!("seller:{}:profile", id);
    let db = state.db.clone();
    let seller_id = id;

    let result = state
        .cache
        .get_or_set(&cache_key, 600, || async move {
            let profile = sqlx::query_as::<_, SellerPublicProfile>(
                r#"SELECT sp.id, u.nickname as user_nickname, sp.seller_type,
                          u.profile_image,
                          sp.total_sales, sp.avg_rating, sp.response_rate, sp.avg_ship_days,
                          COALESCE(sg.grade, 'bronze') as grade,
                          (SELECT COUNT(*) FROM products WHERE seller_id = sp.id AND status = 'active') as product_count,
                          sp.created_at
                   FROM seller_profiles sp
                   JOIN users u ON u.id = sp.user_id
                   LEFT JOIN seller_grades sg ON sg.seller_id = sp.id
                   WHERE sp.id = $1 AND sp.status = 'approved'"#,
            )
            .bind(seller_id)
            .fetch_optional(&db)
            .await
            .map_err(anyhow::Error::from)?
            .ok_or_else(|| anyhow::anyhow!("Seller not found"))?;

            let grade_str = profile.grade.as_deref().unwrap_or("bronze").to_string();
            let grade_badge = crate::domain::seller_grade::GradeLevel::from_str(&grade_str)
                .map(|g| g.display_name().to_string())
                .unwrap_or_else(|| "Bronze".to_string());

            let reviews = sqlx::query_as::<_, RecentReview>(
                r#"SELECT r.id, r.rating, r.content, r.created_at
                   FROM reviews r
                   JOIN products p ON p.id = r.product_id
                   WHERE p.seller_id = $1
                   ORDER BY r.created_at DESC
                   LIMIT 3"#,
            )
            .bind(seller_id)
            .fetch_all(&db)
            .await
            .unwrap_or_default();

            Ok(serde_json::json!({
                "id": profile.id,
                "store_name": profile.user_nickname,
                "profile_image": profile.profile_image,
                "grade": grade_str,
                "grade_badge": grade_badge,
                "total_sales": profile.total_sales.unwrap_or(0),
                "avg_rating": profile.avg_rating,
                "response_rate": profile.response_rate,
                "member_since": profile.created_at,
                "products_count": profile.product_count.unwrap_or(0),
                "recent_reviews": reviews
            }))
        })
        .await
        .map_err(AppError::Internal)?;

    Ok(Json(serde_json::json!({ "data": result })))
}

async fn my_grade(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6b (migration 045): seller_grades.seller_id == seller_profiles(id).
    // auth.id (user_id) 를 sp.id 로 변환 후 조회.
    let grade = sqlx::query_as::<_, crate::domain::seller_grade::SellerGrade>(
        r#"SELECT sg.id, sg.seller_id, sg.grade, sg.score, sg.total_sales, sg.avg_rating,
                  sg.response_rate, sg.dispute_rate, sg.calculated_at, sg.created_at, sg.updated_at
           FROM seller_grades sg
           JOIN seller_profiles sp ON sp.id = sg.seller_id
           WHERE sp.user_id = $1"#,
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?;

    match grade {
        Some(g) => Ok(Json(serde_json::json!({ "data": g }))),
        None => Ok(Json(serde_json::json!({
            "data": {
                "grade": "bronze",
                "score": 0,
                "total_sales": 0,
                "avg_rating": 0,
                "response_rate": 100,
                "dispute_rate": 0,
            }
        }))),
    }
}

async fn my_products(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<SellerProductParams>,
) -> Result<Json<ProductListResponse>, AppError> {
    // Allow sellers (including suspended ones whose role was downgraded) to view their products
    let seller_id = crate::domain::settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // Default to all statuses except 'deleted'; if status filter provided, use it
    let status_filter = params.status.as_deref();

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
           WHERE p.seller_id = $1
             AND ($2::text IS NULL OR p.status = $2)
             AND ($2::text IS NOT NULL OR p.status != 'deleted')
           ORDER BY p.created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(seller_id)
    .bind(status_filter)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = products.first().and_then(|p| p.total_count).unwrap_or(0);

    Ok(Json(ProductListResponse {
        data: products,
        pagination: Pagination::new(page, per_page, total),
    }))
}

/// 판매자 대시보드 통합 통계
async fn dashboard_stats(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_id = crate::domain::settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    // Audit M3 (2026-05-07): 12개 별도 서브쿼리 → 3개 통합 쿼리로 압축.
    // products / orders 각각 한 번 스캔, product_qna+reviews 는 product join 으로 처리.
    let stats = sqlx::query_as::<_, SellerDashboardStats>(
        r#"WITH p_stats AS (
               SELECT
                   COUNT(*) FILTER (WHERE status != 'deleted') AS total_products,
                   COUNT(*) FILTER (WHERE status = 'active')   AS active_products,
                   COUNT(*) FILTER (WHERE status = 'pending')  AS pending_products
               FROM products WHERE seller_id = $1
           ),
           o_stats AS (
               SELECT
                   COUNT(*)                                                                          AS total_orders,
                   COUNT(*) FILTER (WHERE status IN ('payment_verified','paid'))                     AS pending_orders,
                   COUNT(*) FILTER (WHERE status = 'shipped')                                        AS shipping_orders,
                   COUNT(*) FILTER (WHERE status = 'delivered')                                      AS delivered_orders,
                   COUNT(*) FILTER (WHERE status = 'confirmed')                                      AS confirmed_orders,
                   COALESCE(SUM(total_amount) FILTER (
                       WHERE status IN ('delivered','confirmed') AND created_at::date = CURRENT_DATE
                   ), 0) AS today_sales,
                   COALESCE(SUM(total_amount) FILTER (
                       WHERE status IN ('delivered','confirmed') AND created_at >= date_trunc('month', CURRENT_DATE)
                   ), 0) AS month_sales
               FROM orders WHERE seller_id = $1
           ),
           q_stats AS (
               SELECT COUNT(*) AS unanswered_qna
               FROM product_qna pq JOIN products p ON p.id = pq.product_id
               WHERE p.seller_id = $1 AND pq.answer IS NULL
           ),
           r_stats AS (
               SELECT COUNT(*) AS new_reviews
               FROM reviews r JOIN products p ON p.id = r.product_id
               WHERE p.seller_id = $1 AND r.created_at > NOW() - INTERVAL '7 days'
           )
           SELECT
               p_stats.total_products,
               p_stats.active_products,
               p_stats.pending_products,
               o_stats.total_orders,
               o_stats.pending_orders,
               o_stats.shipping_orders,
               o_stats.delivered_orders,
               o_stats.confirmed_orders,
               q_stats.unanswered_qna,
               r_stats.new_reviews,
               o_stats.today_sales,
               o_stats.month_sales
           FROM p_stats, o_stats, q_stats, r_stats"#,
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": stats })))
}

/// 내 상품 리뷰 전체 조회
async fn my_reviews(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<SellerReviewParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_id = crate::domain::settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let reviews = sqlx::query_as::<_, SellerReview>(
        r#"SELECT r.id, r.product_id, p.title as product_title, r.rating, r.content,
                  COALESCE(u.nickname, u.username) as user_nickname, r.created_at,
                  r.seller_reply, r.seller_replied_at,
                  COUNT(*) OVER() as total_count
           FROM reviews r
           JOIN products p ON p.id = r.product_id
           JOIN users u ON u.id = r.buyer_id
           WHERE p.seller_id = $1
           ORDER BY r.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(seller_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = reviews.first().and_then(|r| r.total_count).unwrap_or(0);

    Ok(Json(serde_json::json!({
        "data": reviews,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

/// 리뷰 답변 등록/수정
async fn reply_review(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(review_id): Path<Uuid>,
    Json(req): Json<ReplyReviewRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_id = crate::domain::settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    // Verify the review belongs to a product owned by this seller
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.id = $1 AND p.seller_id = $2)",
    )
    .bind(review_id)
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(AppError::NotFound("Review not found".into()));
    }

    let reply = req.reply.trim();
    if reply.is_empty() {
        return Err(AppError::Validation {
            message: "Reply cannot be empty".into(),
            field: Some("reply".into()),
        });
    }

    sqlx::query(
        "UPDATE reviews SET seller_reply = $1, seller_replied_at = NOW(), updated_at = NOW() WHERE id = $2",
    )
    .bind(reply)
    .bind(review_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

/// 내 상품 Q&A 전체 조회
async fn my_qna(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<SellerQnaParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_id = crate::domain::settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let answered_filter = params.answered;

    let items = sqlx::query_as::<_, SellerQna>(
        r#"SELECT pq.id, pq.product_id, p.title as product_title,
                  COALESCE(u.nickname, u.username) as user_nickname,
                  pq.question, pq.answer, pq.answered_at, pq.is_secret, pq.created_at,
                  COUNT(*) OVER() as total_count
           FROM product_qna pq
           JOIN products p ON p.id = pq.product_id
           JOIN users u ON u.id = pq.user_id
           WHERE p.seller_id = $1
             AND ($2::bool IS NULL OR ($2 = true AND pq.answer IS NOT NULL) OR ($2 = false AND pq.answer IS NULL))
           ORDER BY pq.created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(seller_id)
    .bind(answered_filter)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = items.first().and_then(|q| q.total_count).unwrap_or(0);

    Ok(Json(serde_json::json!({
        "data": items,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

/// 30일 수익 분석 (매출/수수료/순수익/마진율/환불률/분쟁률)
/// 프론트의 SellerStatsPage.tsx profitAnalysis 가 cancelled/refunded 까지 매출에
/// 포함시키던 버그를 백엔드 단일 SQL 로 정확히 계산하도록 대체.
async fn profit_analysis(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    use std::str::FromStr;

    let seller_id = crate::domain::settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    // 60-day window so we can compare last 30 days vs the prior 30 days in one round-trip.
    // "current" = last 30 days (CURRENT_DATE - 29 days .. CURRENT_DATE)
    // "previous" = the 30 days before that (CURRENT_DATE - 59 days .. CURRENT_DATE - 30 days)
    // v1.3.11 — settlement summary 와 같은 식으로 per-order commission 합산.
    // 이전 코드는 SUM(total_amount) × global commission_rate (5%) 로 계산해서
    // 카테고리별 다른 수수료율이 들어간 주문에서 settlement 와 값이 어긋났다.
    // 이제 orders.commission_amount (있으면) / 없으면 total_amount × commission_rate / 100
    // 으로 settlement 의 calculate_seller_balance 와 동일한 로직.
    let agg: ProfitAggregateRow = sqlx::query_as(
        r#"WITH window_orders AS (
               SELECT
                   status,
                   total_amount,
                   margin_amount,
                   COALESCE(commission_amount,
                            total_amount * COALESCE(commission_rate, 5.00) / 100) AS order_commission,
                   created_at::date AS day
               FROM orders
               WHERE seller_id = $1
                 AND created_at >= CURRENT_DATE - INTERVAL '59 days'
           ),
           current AS (
               SELECT * FROM window_orders WHERE day >= CURRENT_DATE - INTERVAL '29 days'
           ),
           previous AS (
               SELECT * FROM window_orders WHERE day <  CURRENT_DATE - INTERVAL '29 days'
           )
           SELECT
               COALESCE((SELECT SUM(total_amount)     FROM current  WHERE status IN ('delivered','confirmed')), 0)::numeric AS total_revenue,
               COALESCE((SELECT SUM(margin_amount)    FROM current  WHERE status IN ('delivered','confirmed')), 0)::numeric AS total_margin,
               COALESCE((SELECT SUM(order_commission) FROM current  WHERE status IN ('delivered','confirmed')), 0)::numeric AS total_commission,
               (SELECT COUNT(*) FROM current)                                                       AS total_orders,
               (SELECT COUNT(*) FROM current WHERE status IN ('delivered','confirmed'))             AS revenue_orders,
               (SELECT COUNT(*) FROM current WHERE status = 'refunded')                             AS refunded_orders,
               (SELECT COUNT(*) FROM current WHERE status = 'disputed')                             AS disputed_orders,
               COALESCE((SELECT SUM(total_amount) FROM previous WHERE status IN ('delivered','confirmed')), 0)::numeric AS previous_revenue
           "#,
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    let commission = agg
        .total_commission
        .with_scale_round(2, bigdecimal::RoundingMode::HalfUp);
    let net_profit = &agg.total_revenue - &commission;

    // 표시용 평균 수수료율 (commission/revenue * 100). 매출 0이면 글로벌 fallback.
    let revenue_f = bigdecimal_to_f64(&agg.total_revenue);
    let commission_f = bigdecimal_to_f64(&commission);
    let display_rate_pct = if revenue_f > 0.0 {
        (commission_f / revenue_f) * 100.0
    } else {
        BigDecimal::from_str(&state.config.commission_rate)
            .map(|r| bigdecimal_to_f64(&r) * 100.0)
            .unwrap_or(5.0)
    };

    let margin_f = bigdecimal_to_f64(&agg.total_margin);
    let avg_margin_rate = if revenue_f > 0.0 {
        (margin_f / revenue_f) * 100.0
    } else {
        0.0
    };
    let refund_rate = if agg.total_orders > 0 {
        (agg.refunded_orders as f64 / agg.total_orders as f64) * 100.0
    } else {
        0.0
    };
    let dispute_rate = if agg.total_orders > 0 {
        (agg.disputed_orders as f64 / agg.total_orders as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(serde_json::json!({ "data": {
        "window":           "30d",
        "total_revenue":    agg.total_revenue.to_string(),
        "total_margin":     agg.total_margin.to_string(),
        // 표시용 효과 수수료율(%) — UI 가 라벨에 그대로 노출 가능.
        "commission_rate_pct": round1(display_rate_pct),
        "commission":       commission.to_string(),
        "net_profit":       net_profit.to_string(),
        "avg_margin_rate":  round1(avg_margin_rate),
        "refund_rate":      round1(refund_rate),
        "dispute_rate":     round1(dispute_rate),
        "total_orders":     agg.total_orders,
        "revenue_orders":   agg.revenue_orders,
        "refunded_orders":  agg.refunded_orders,
        "disputed_orders":  agg.disputed_orders,
        "previous_revenue": agg.previous_revenue.to_string(),
    } })))
}

fn bigdecimal_to_f64(v: &BigDecimal) -> f64 {
    use std::str::FromStr;
    f64::from_str(&v.to_string()).unwrap_or(0.0)
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

/// 매출 통계 (일별 30일)
async fn sales_stats(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_id = crate::domain::settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let daily = sqlx::query_as::<_, DailySales>(
        r#"SELECT d::date as date,
                  COUNT(o.id) as order_count,
                  COALESCE(SUM(o.total_amount), 0) as total_amount
           FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day') d
           LEFT JOIN orders o ON o.seller_id = $1
             AND o.created_at::date = d::date
             AND o.status IN ('delivered', 'confirmed')
           GROUP BY d::date
           ORDER BY d::date"#,
    )
    .bind(seller_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": daily })))
}

/// 판매자 프로필 수정
async fn update_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let _profile =
        sqlx::query_as::<_, SellerProfile>("SELECT * FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    if let Some(ref addr) = req.wallet_address {
        crate::domain::wallet::validate_wallet_address(addr)?;
    }

    // Validate seller_type if provided
    if let Some(ref st) = req.seller_type {
        if st != "individual" && st != "business" {
            return Err(AppError::Validation {
                message: "Seller type must be 'individual' or 'business'".into(),
                field: Some("seller_type".into()),
            });
        }
    }

    // v1.3.10 운영 정책 — 지갑 한 번 등록하면 변경 불가.
    // wallet_address 가 새로 들어오면 wallet_locked = FALSE 인 경우만 허용 +
    // 같은 UPDATE 에서 wallet_locked = TRUE 로 set.
    // 다른 필드(연락처/사업자 정보 등)와는 분리해서 처리해야 잠금 회피가 안 된다.
    // (지갑 변경이 거절돼도 다른 필드는 정상 저장되어야 한다.)
    if req.wallet_address.is_some() {
        let result = sqlx::query(
            r#"UPDATE seller_profiles SET
                   wallet_address = $1,
                   wallet_locked = TRUE,
                   updated_at = NOW()
               WHERE user_id = $2 AND wallet_locked = FALSE"#,
        )
        .bind(&req.wallet_address)
        .bind(auth.id)
        .execute(&state.db)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::Validation {
                message: "이미 등록된 지갑 주소는 변경할 수 없습니다.".into(),
                field: Some("wallet_address".into()),
            });
        }
    }

    sqlx::query(
        r#"UPDATE seller_profiles SET
            contact_phone = COALESCE($1, contact_phone),
            seller_type = COALESCE($2, seller_type),
            business_name = COALESCE($3, business_name),
            business_number = COALESCE($4, business_number),
            representative_name = COALESCE($5, representative_name),
            business_address = COALESCE($6, business_address),
            business_type = COALESCE($7, business_type),
            business_category = COALESCE($8, business_category),
            updated_at = NOW()
           WHERE user_id = $9"#,
    )
    .bind(&req.contact_phone)
    .bind(&req.seller_type)
    .bind(&req.business_name)
    .bind(&req.business_number)
    .bind(&req.representative_name)
    .bind(&req.business_address)
    .bind(&req.business_type)
    .bind(&req.business_category)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

// --- Seller Refund Management ---

async fn list_seller_refunds(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<crate::domain::refund::RefundListQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_profile =
        sqlx::query_as::<_, (Uuid,)>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    let seller_id = seller_profile.0;
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("");

    let query = if status_filter.is_empty() || status_filter == "all" {
        format!(
            "SELECT {} {} WHERE rr.seller_id = $1 ORDER BY rr.created_at DESC LIMIT $2 OFFSET $3",
            crate::domain::refund::REFUND_WITH_INFO_SELECT,
            crate::domain::refund::REFUND_WITH_INFO_JOIN,
        )
    } else {
        format!(
            "SELECT {} {} WHERE rr.seller_id = $1 AND rr.status = $4 ORDER BY rr.created_at DESC LIMIT $2 OFFSET $3",
            crate::domain::refund::REFUND_WITH_INFO_SELECT,
            crate::domain::refund::REFUND_WITH_INFO_JOIN,
        )
    };

    let refunds = if status_filter.is_empty() || status_filter == "all" {
        sqlx::query_as::<_, crate::domain::refund::RefundRequestWithInfo>(&query)
            .bind(seller_id)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await?
    } else {
        sqlx::query_as::<_, crate::domain::refund::RefundRequestWithInfo>(&query)
            .bind(seller_id)
            .bind(per_page)
            .bind(offset)
            .bind(status_filter)
            .fetch_all(&state.db)
            .await?
    };

    let total = refunds.first().and_then(|r| r.total_count).unwrap_or(0);

    Ok(Json(serde_json::json!({
        "data": refunds,
        "pagination": crate::domain::common::Pagination::new(page, per_page, total),
    })))
}

async fn respond_to_refund(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(refund_id): Path<Uuid>,
    Json(req): Json<crate::domain::refund::SellerRefundResponse>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.action != "approve" && req.action != "reject" {
        return Err(AppError::Validation {
            message: "action must be 'approve' or 'reject'".into(),
            field: Some("action".into()),
        });
    }

    let seller_profile =
        sqlx::query_as::<_, (Uuid,)>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    let seller_id = seller_profile.0;

    // R3-1 FIX: Use transaction + FOR UPDATE to prevent double-submit race condition
    let mut tx = state.db.begin().await?;

    let refund = sqlx::query_as::<_, (Uuid, Uuid, String)>(
        "SELECT order_id, buyer_id, status FROM refund_requests WHERE id = $1 AND seller_id = $2 FOR UPDATE",
    )
    .bind(refund_id)
    .bind(seller_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Refund request not found".into()))?;

    let (order_id, buyer_id, status) = refund;

    if status != "requested" {
        return Err(AppError::Validation {
            message: "Refund is not in the expected status. Only 'requested' refunds can be responded to.".into(),
            field: Some("status".into()),
        });
    }

    let order_number =
        sqlx::query_scalar::<_, String>("SELECT order_number FROM orders WHERE id = $1")
            .bind(order_id)
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or_default();

    match req.action.as_str() {
        "approve" => {
            sqlx::query(
                r#"UPDATE refund_requests SET
                    status = 'seller_approved',
                    seller_response = 'approve',
                    seller_responded_at = NOW(),
                    updated_at = NOW()
                   WHERE id = $1"#,
            )
            .bind(refund_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;

            let _ = crate::domain::notification::create_notification(
                &state.db, Some(&state.ws_hub), buyer_id,
                "refund", "환불 승인",
                &format!("주문 #{}의 환불 요청이 판매자에 의해 승인되었습니다. 관리자 처리를 기다려주세요.", order_number),
                Some(&format!("/refunds/{}", refund_id)),
            ).await;

            // M-2: 관리자에게도 알림 발송 (승인된 환불 처리 필요)
            let admin_ids =
                sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE role = 'admin' LIMIT 5")
                    .fetch_all(&state.db)
                    .await
                    .unwrap_or_default();

            for admin_id in admin_ids {
                let _ = crate::domain::notification::create_notification(
                    &state.db, Some(&state.ws_hub), admin_id,
                    "refund", "환불 처리 필요",
                    &format!("주문 #{}의 환불 요청이 판매자에 의해 승인되었습니다. 환불 처리가 필요합니다.", order_number),
                    Some("/admin/refunds"),
                ).await;
            }

            Ok(Json(serde_json::json!({
                "data": { "id": refund_id, "status": "seller_approved" }
            })))
        }
        "reject" => {
            let reason = req.reason.as_deref().unwrap_or("판매자 거절");

            sqlx::query(
                r#"UPDATE refund_requests SET
                    status = 'seller_rejected',
                    seller_response = 'reject',
                    seller_reason = $2,
                    seller_responded_at = NOW(),
                    updated_at = NOW()
                   WHERE id = $1"#,
            )
            .bind(refund_id)
            .bind(reason)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;

            let _ = crate::domain::notification::create_notification(
                &state.db, Some(&state.ws_hub), buyer_id,
                "refund", "환불 거절",
                &format!("주문 #{}의 환불 요청이 판매자에 의해 거절되었습니다. 분쟁을 제기할 수 있습니다.", order_number),
                Some(&format!("/refunds/{}", refund_id)),
            ).await;

            Ok(Json(serde_json::json!({
                "data": { "id": refund_id, "status": "seller_rejected", "seller_reason": reason }
            })))
        }
        _ => unreachable!(),
    }
}

/// FR-08: 셀러 UDG 정산 연동 내역 조회
async fn seller_udg_history(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<SellerProductParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM seller_profiles WHERE user_id = $1 AND status = 'active'",
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            BigDecimal,
            BigDecimal,
            Option<DateTime<Utc>>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"SELECT o.id, o.order_number, o.total_amount, o.margin_amount,
                  o.udg_event_sent_at, o.udg_distribution_id,
                  we.status as webhook_status
           FROM orders o
           LEFT JOIN webhook_events we ON we.order_id = o.id AND we.event_type = 'order.confirmed'
           WHERE o.seller_id = $1
             AND o.udg_event_sent_at IS NOT NULL
           ORDER BY o.udg_event_sent_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(seller)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM orders WHERE seller_id = $1 AND udg_event_sent_at IS NOT NULL",
    )
    .bind(seller)
    .fetch_one(&state.db)
    .await?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "order_id": r.0,
                "order_number": r.1,
                "total_amount": r.2.to_string(),
                "margin_amount": r.3.to_string(),
                "udg_event_sent_at": r.4,
                "distribution_id": r.5,
                "webhook_status": r.6,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "data": items,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

// --- Seller Deposit System ---

#[derive(Debug, Deserialize)]
pub struct SubmitDepositRequest {
    pub txid: String,
    pub amount: f64,
    pub network: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DepositSubmission {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub txid: String,
    pub amount: BigDecimal,
    pub network: String,
    pub status: String,
    pub verified_at: Option<DateTime<Utc>>,
    pub admin_note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// POST /api/seller/deposit — Submit deposit TXID
async fn submit_deposit(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<SubmitDepositRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify seller profile exists.
    // Audit M2 (2026-05-07): rejected/suspended 판매자가 새 deposit 제출하지 못하도록
    // status='pending' 또는 'approved' 만 허용. (정지 시 기존 deposit 은 refund_pending
    // 으로 마킹되어 별도 처리됨.)
    let profile =
        sqlx::query_as::<_, SellerProfile>("SELECT * FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| {
                AppError::NotFound(
                    "Seller profile not found. Please apply as a seller first.".into(),
                )
            })?;

    if profile.status.as_deref() != Some("pending") && profile.status.as_deref() != Some("approved") {
        return Err(AppError::Forbidden(format!(
            "Cannot submit deposit while seller profile status is '{}'",
            profile.status.as_deref().unwrap_or("unknown")
        )));
    }

    // Validate TXID format
    let txid = req.txid.trim();
    if txid.is_empty() || txid.len() > 128 {
        return Err(AppError::Validation {
            message: "TXID must be between 1 and 128 characters".into(),
            field: Some("txid".into()),
        });
    }

    // Validate amount
    if req.amount <= 0.0 {
        return Err(AppError::Validation {
            message: "Amount must be greater than 0".into(),
            field: Some("amount".into()),
        });
    }

    // LOW backlog (Audit Seller M-10): USDT 는 최대 6자리 소수.
    // 7자리 이상 입력 시 블록체인 verify 단계에서 fail 하므로 사전 차단.
    // 또한 비현실적 큰 금액 (1B USDT 초과) 도 input mistake 로 차단.
    let amount_str = format!("{:.6}", req.amount);
    let trimmed = amount_str.trim_end_matches('0').trim_end_matches('.');
    let after_dot = trimmed.split('.').nth(1).unwrap_or("");
    if after_dot.len() > 6 {
        return Err(AppError::Validation {
            message: "Amount can have at most 6 decimal places (USDT precision)".into(),
            field: Some("amount".into()),
        });
    }
    if req.amount > 1_000_000_000.0 {
        return Err(AppError::Validation {
            message: "Amount exceeds reasonable maximum (1B USDT)".into(),
            field: Some("amount".into()),
        });
    }

    let network = req.network.as_deref().unwrap_or("trc20");
    if network != "trc20" && network != "erc20" {
        return Err(AppError::Validation {
            message: "Network must be 'trc20' or 'erc20'".into(),
            field: Some("network".into()),
        });
    }

    // Round 6c (migration 046): seller_deposit_submissions.seller_id == seller_profiles(id).
    let seller_profile_id =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    // Check no pending deposit already exists
    let has_pending = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM seller_deposit_submissions WHERE seller_id = $1 AND status = 'pending')",
    )
    .bind(seller_profile_id)
    .fetch_one(&state.db)
    .await?;

    if has_pending {
        return Err(AppError::Conflict(
            "A pending deposit submission already exists. Please wait for it to be verified."
                .into(),
        ));
    }

    // Check TXID is not already used in deposit submissions
    let txid_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM seller_deposit_submissions WHERE txid = $1)",
    )
    .bind(txid)
    .fetch_one(&state.db)
    .await?;

    if txid_exists {
        return Err(AppError::Conflict(
            "This TXID has already been submitted.".into(),
        ));
    }

    let id = Uuid::new_v4();
    let amount = BigDecimal::try_from(req.amount).unwrap_or_else(|_| BigDecimal::from(0));

    // Audit M1 (2026-05-07): EXISTS 체크와 INSERT 사이 race 처리.
    sqlx::query(
        r#"INSERT INTO seller_deposit_submissions (id, seller_id, txid, amount, network, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')"#,
    )
    .bind(id)
    .bind(seller_profile_id)
    .bind(txid)
    .bind(&amount)
    .bind(network)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23505") {
                return AppError::Conflict("This TXID has already been submitted".into());
            }
        }
        AppError::Database(e)
    })?;

    Ok(Json(serde_json::json!({
        "data": {
            "id": id,
            "txid": txid,
            "amount": amount.to_string(),
            "network": network,
            "status": "pending",
            "message": "보증금 TXID가 접수되었습니다. 관리자 확인 후 처리됩니다."
        }
    })))
}

/// GET /api/seller/deposit/status — Check latest deposit status
async fn deposit_status(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify seller profile exists
    let _profile =
        sqlx::query_as::<_, SellerProfile>("SELECT * FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    // Get required deposit amount from system settings
    let required_amount = sqlx::query_scalar::<_, String>(
        "SELECT value FROM system_settings WHERE key = 'seller_deposit_amount'",
    )
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_else(|| "0".to_string());

    // Round 6c: seller_deposit_submissions.seller_id == seller_profiles(id).
    let submission = sqlx::query_as::<_, DepositSubmission>(
        r#"SELECT sds.id, sds.seller_id, sds.txid, sds.amount, sds.network, sds.status, sds.verified_at, sds.admin_note, sds.created_at, sds.updated_at
           FROM seller_deposit_submissions sds
           JOIN seller_profiles sp ON sp.id = sds.seller_id
           WHERE sp.user_id = $1
           ORDER BY sds.created_at DESC
           LIMIT 1"#,
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?;

    match submission {
        Some(sub) => Ok(Json(serde_json::json!({
            "data": {
                "submission": sub,
                "required_amount": required_amount,
            }
        }))),
        None => Ok(Json(serde_json::json!({
            "data": {
                "submission": null,
                "required_amount": required_amount,
            }
        }))),
    }
}
