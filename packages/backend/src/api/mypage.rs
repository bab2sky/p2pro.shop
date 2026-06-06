use axum::{extract::State, routing::get, Extension, Json, Router};
use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub fn router() -> Router<AppState> {
    Router::new().route("/dashboard", get(dashboard))
}

#[derive(Debug, Serialize)]
struct DashboardResponse {
    data: DashboardData,
}

#[derive(Debug, Serialize)]
struct DashboardData {
    user: UserInfo,
    order_counts: OrderCounts,
    recent_orders: Vec<RecentOrder>,
    coupon_count: i64,
    wishlist_count: i64,
    total_orders: i64,
    total_spent: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct UserInfo {
    nickname: Option<String>,
    profile_image: Option<String>,
    created_at: Option<DateTime<Utc>>,
    is_udg_member: Option<bool>,
}

#[derive(Debug, Serialize)]
struct OrderCounts {
    pending_payment: i64,
    payment_verified: i64,
    shipped: i64,
    delivered: i64,
    confirmed: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct RecentOrder {
    id: Uuid,
    order_number: String,
    status: String,
    total_amount: BigDecimal,
    first_item_title: Option<String>,
    first_item_image: Option<String>,
    item_count: Option<i64>,
    created_at: Option<DateTime<Utc>>,
}

async fn dashboard(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<DashboardResponse>, AppError> {
    let user_id = auth.id;

    // 1. User info
    let user = sqlx::query_as::<_, UserInfo>(
        "SELECT nickname, profile_image, created_at, is_udg_member FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    // 2. Order counts + totals (single query)
    let counts = sqlx::query!(
        r#"SELECT
          COUNT(*) FILTER (WHERE status = 'pending_payment') AS "pending_payment!: i64",
          COUNT(*) FILTER (WHERE status = 'payment_verified') AS "payment_verified!: i64",
          COUNT(*) FILTER (WHERE status = 'shipped') AS "shipped!: i64",
          COUNT(*) FILTER (WHERE status = 'delivered') AS "delivered!: i64",
          COUNT(*) FILTER (WHERE status = 'confirmed') AS "confirmed!: i64",
          COUNT(*) AS "total_orders!: i64",
          COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) AS "total_spent!: BigDecimal"
        FROM orders WHERE buyer_id = $1"#,
        user_id
    )
    .fetch_one(&state.db)
    .await?;

    // 3. Recent 3 orders
    let recent_orders = sqlx::query_as::<_, RecentOrder>(
        r#"SELECT o.id, o.order_number, o.status::TEXT AS status, o.total_amount,
              o.created_at,
              (SELECT oi.product_title FROM order_items oi WHERE oi.order_id = o.id LIMIT 1) AS first_item_title,
              (SELECT pi.image_url FROM order_items oi
               JOIN product_images pi ON pi.product_id = oi.product_id AND pi.is_main = true
               WHERE oi.order_id = o.id LIMIT 1) AS first_item_image,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
           FROM orders o
           WHERE o.buyer_id = $1
           ORDER BY o.created_at DESC
           LIMIT 3"#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    // 4. Coupon count (available only)
    let coupon_count = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM user_coupons uc
           JOIN coupons c ON c.id = uc.coupon_id
           WHERE uc.user_id = $1 AND uc.used_at IS NULL
             AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
             AND c.is_active = TRUE"#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // 5. Wishlist count
    let wishlist_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM wishlist WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);

    Ok(Json(DashboardResponse {
        data: DashboardData {
            user,
            order_counts: OrderCounts {
                pending_payment: counts.pending_payment,
                payment_verified: counts.payment_verified,
                shipped: counts.shipped,
                delivered: counts.delivered,
                confirmed: counts.confirmed,
            },
            recent_orders,
            coupon_count,
            wishlist_count,
            total_orders: counts.total_orders,
            total_spent: counts.total_spent.to_string(),
        },
    }))
}
