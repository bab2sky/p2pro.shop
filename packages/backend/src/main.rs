use std::net::SocketAddr;
use std::sync::Arc;

use axum::{middleware::from_fn, routing::get, Router};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use p2pro_backend::{api, cache, config, db, middleware, scheduler, ws, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv_override().ok();

    // Sentry initialization (must be before tracing)
    let _sentry_guard = if let Ok(dsn) = std::env::var("SENTRY_DSN") {
        Some(sentry::init((
            dsn,
            sentry::ClientOptions {
                release: sentry::release_name!(),
                environment: Some(
                    std::env::var("SENTRY_ENVIRONMENT")
                        .unwrap_or_else(|_| "development".into())
                        .into(),
                ),
                traces_sample_rate: std::env::var("SENTRY_TRACES_RATE")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.1),
                ..Default::default()
            },
        )))
    } else {
        tracing::info!("SENTRY_DSN not set, Sentry disabled");
        None
    };

    // FR-28: Conditional JSON logging
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "p2pro_backend=debug,tower_http=debug".into());

    let log_format = std::env::var("RUST_LOG_FORMAT").unwrap_or_else(|_| "text".into());

    if log_format == "json" {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer().json())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer())
            .init();
    }

    let config = config::AppConfig::from_env()?;
    let port = config.server_port;

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Migrations applied");

    // Seed default admin user if none exists
    p2pro_backend::seed::seed_admin(&pool).await?;

    let redis = redis::Client::open(config.redis_url.as_str())?;
    tracing::info!("Redis client created");

    let cache = cache::CacheLayer::new(redis.clone());

    let ws_hub = ws::WsHub::new();

    // FR-16: Shared HTTP client for external API calls
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .pool_max_idle_per_host(10)
        .build()?;

    let state = AppState {
        db: pool,
        redis,
        cache,
        config: Arc::new(config.clone()),
        ws_hub: ws_hub.clone(),
        http_client,
        user_rate_limiters: middleware::rate_limit::UserRateLimiters::new(),
    };

    // Start background scheduler
    tokio::spawn(scheduler::start_scheduler(state.clone()));

    let rate_limiters = middleware::rate_limit::RateLimiters::new();
    tracing::info!("Rate limiters created (7 tiers)");

    // FR-10: CORS restriction based on ALLOWED_ORIGINS
    let cors = if config.allowed_origins.iter().any(|o| o == "*") {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        use axum::http::HeaderValue;
        let origins: Vec<HeaderValue> = config
            .allowed_origins
            .iter()
            .filter_map(|o| o.parse().ok())
            .collect();
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([
                axum::http::Method::GET,
                axum::http::Method::POST,
                axum::http::Method::PUT,
                axum::http::Method::DELETE,
                axum::http::Method::OPTIONS,
            ])
            .allow_headers([
                axum::http::header::AUTHORIZATION,
                axum::http::header::CONTENT_TYPE,
                axum::http::header::ACCEPT,
            ])
            .allow_credentials(true)
    };

    let upload_dir = state.config.upload_dir.clone();

    // FR-24: Middleware layer order (outermost → innermost):
    // 1. CORS — fast preflight handling
    // 2. TraceLayer — HTTP request logging
    // 3. Sentry — error tracking
    // 4. Security headers — X-Frame-Options, CSP, HSTS etc.
    // 5. Global rate limit — DDoS protection
    // 6. Extensions — WsHub, rate_limiters
    // 7. Routes — business logic (per-IP rate limits applied inside)
    let app = Router::new()
        .nest(
            "/api",
            api::api_router(state.clone(), rate_limiters.clone()),
        )
        .route("/ws/chat", get(ws::handle_ws_upgrade))
        .route("/ws/notifications", get(ws::handle_notify_ws_upgrade))
        .nest_service("/uploads", ServeDir::new(upload_dir))
        .with_state(state)
        .layer(axum::Extension(ws_hub))
        .layer(axum::Extension(rate_limiters.default.clone()))
        .layer(from_fn(middleware::rate_limit::rate_limit_middleware))
        .layer(from_fn(middleware::security::security_headers_middleware))
        // Note: sentry-tower layers removed due to incompatibility with axum 0.8 UnsyncBoxBody.
        // Sentry error capture is handled through the `tracing` integration.
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
