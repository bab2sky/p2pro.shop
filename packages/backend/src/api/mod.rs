use axum::{middleware::from_fn_with_state, Router};

mod addresses;
mod admin;
mod analytics;
pub mod auth;
mod banners;
mod bulk;
mod cart;
mod categories;
mod chat;
mod coupons;
mod delivery;
mod disputes;
mod exchange;
mod faq;
pub mod health;
mod legal;
mod mypage;
mod notices;
mod notifications;
pub mod oauth;
pub mod orders;
mod products;
mod profile;
mod profit;
mod qna;
mod refunds;
mod reviews;
mod search;
mod seller;
mod settlements;
mod support;
mod upload;
mod wishlist;

use crate::middleware::auth::auth_middleware;
use crate::middleware::rate_limit::{ip_rate_limit_middleware, RateLimiters};
use crate::middleware::role::require_admin;
use crate::AppState;

pub fn api_router(state: AppState, rate_limiters: RateLimiters) -> Router<AppState> {
    // Auth routes with IP-based rate limiting (5/min per IP)
    let auth_routes = Router::new()
        .nest("/auth", auth::router())
        .layer(axum::middleware::from_fn(ip_rate_limit_middleware))
        .layer(axum::Extension(rate_limiters.auth_login.clone()));

    // /auth/check-* 는 enumeration 방어용 stricter limit (1/min/IP).
    // 가입 폼 자동검증은 한 번에 1~2회 호출이라 충분히 통과.
    let auth_enumeration_routes = Router::new()
        .nest("/auth", auth::enumeration_router())
        .layer(axum::middleware::from_fn(ip_rate_limit_middleware))
        .layer(axum::Extension(rate_limiters.auth_enumeration.clone()));

    // Forgot-password with dedicated IP rate limit (3/min per IP)
    let forgot_password_routes = Router::new()
        .merge(auth::forgot_password_router())
        .layer(axum::middleware::from_fn(ip_rate_limit_middleware))
        .layer(axum::Extension(rate_limiters.forgot_password.clone()));

    // Chatbot support with dedicated rate limit (10/min per IP)
    let chatbot_routes = Router::new()
        .route("/chat/support", axum::routing::post(support::chat_support))
        .layer(axum::middleware::from_fn(ip_rate_limit_middleware))
        .layer(axum::Extension(rate_limiters.chatbot.clone()));

    // Public routes (no auth required)
    let public = Router::new()
        .route("/health", axum::routing::get(health::health_check))
        .merge(auth_routes)
        .merge(auth_enumeration_routes)
        .merge(forgot_password_routes)
        .merge(chatbot_routes)
        .nest("/categories", categories::router())
        .nest("/sellers", seller::public_router())
        .merge(qna::product_qna_public_router())
        .merge(reviews::public_router())
        .nest("/notices", notices::public_router())
        .nest("/banners", banners::public_router())
        .nest("/faq", faq::public_router())
        .merge(oauth::public_router())
        .nest("/legal", legal::public_router())
        .merge(legal::seller_business_router())
        .merge(legal::category_attributes_router())
        .merge(legal::product_legal_public_router())
        .merge(search::public_router())
        .merge(bulk::view_router())
        .merge(analytics::time_deal_public_router())
        .merge(analytics::surcharge_router())
        .merge(orders::public_router());

    // Products: read = public, write = auth checked in handler via optional_auth middleware
    let products = Router::new()
        .nest("/products", products::router())
        .layer(from_fn_with_state(
            state.clone(),
            crate::middleware::auth::optional_auth_middleware,
        ));

    // Orders get 10/min per-IP rate limit (covers create, txid submit, network change, etc.)
    let orders_with_rate_limit = Router::new()
        .nest("/orders", orders::router())
        .layer(axum::middleware::from_fn(ip_rate_limit_middleware))
        .layer(axum::Extension(rate_limiters.orders.clone()));

    // Protected routes (auth required — returns 401 if no token)
    let protected = Router::new()
        .nest("/cart", cart::router())
        .merge(orders_with_rate_limit)
        .nest("/seller", seller::router())
        .nest("/seller", orders::seller_router())
        .nest("/seller", settlements::router())
        .nest("/wishlist", wishlist::router())
        .nest("/addresses", addresses::router())
        .nest("/notifications", notifications::router())
        .nest("/chat", chat::router())
        .merge(qna::product_qna_protected_router())
        .merge(reviews::protected_router())
        .merge(upload::router())
        .nest("/my", mypage::router())
        .nest("/profile", profile::router())
        .nest("/disputes", disputes::router())
        .nest("/refunds", refunds::router())
        .merge(refunds::order_refund_router())
        .nest("/coupons", coupons::user_router())
        .merge(coupons::checkout_router())
        .nest("/seller", coupons::seller_router())
        .merge(delivery::buyer_router())
        .merge(oauth::protected_router())
        .nest("/seller", delivery::seller_router())
        .merge(legal::product_attributes_router())
        .merge(bulk::seller_router())
        .merge(exchange::buyer_router())
        .merge(exchange::inquiry_buyer_router())
        .nest("/seller", exchange::seller_router())
        .nest("/seller", exchange::inquiry_seller_router())
        .nest("/seller", analytics::seller_router())
        .nest("/seller", analytics::time_deal_seller_router())
        .nest("/seller", profit::seller_profit_router())
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // Admin read routes: 30/min per IP (image_upload limiter).
    // Request execution order: Extension(insert limiter) -> ip_rate_limit -> auth -> require_admin -> handler.
    let admin_read = Router::new()
        .nest("/admin", admin::read_router())
        .nest("/admin", coupons::admin_read_router())
        .layer(from_fn_with_state(state.clone(), require_admin))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .layer(axum::middleware::from_fn(ip_rate_limit_middleware))
        .layer(axum::Extension(rate_limiters.image_upload.clone()));

    // Admin write routes: 10/min per IP (orders limiter).
    let admin_write = Router::new()
        .nest("/admin", admin::write_router())
        .nest("/admin", notices::admin_router())
        .nest("/admin", banners::admin_router())
        .nest("/admin", faq::admin_router())
        .nest("/admin", coupons::admin_write_router())
        .layer(from_fn_with_state(state.clone(), require_admin))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .layer(axum::middleware::from_fn(ip_rate_limit_middleware))
        .layer(axum::Extension(rate_limiters.orders.clone()));

    Router::new()
        .merge(public)
        .merge(products)
        .merge(protected)
        .merge(admin_read)
        .merge(admin_write)
}
