pub mod api;
pub mod cache;
pub mod config;
pub mod db;
pub mod domain;
pub mod error;
pub mod middleware;
pub mod scheduler;
pub mod seed;
pub mod ws;

pub use error::AppError;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub redis: redis::Client,
    pub cache: cache::CacheLayer,
    pub config: std::sync::Arc<config::AppConfig>,
    pub ws_hub: ws::WsHub,
    pub http_client: reqwest::Client,
    /// FR-20: User-keyed rate limiters for sensitive authenticated endpoints
    pub user_rate_limiters: middleware::rate_limit::UserRateLimiters,
}
