use axum::{extract::State, Json};
use std::time::Instant;

use crate::AppState;

/// GET /api/health
///
/// DB + Redis + UDG Webhook 연결 상태 확인. 인증 불필요.
pub async fn health_check(State(state): State<AppState>) -> Json<serde_json::Value> {
    let start = Instant::now();

    // DB ping
    let db_status = match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
    {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };

    // Redis ping
    let redis_status = match state.redis.get_multiplexed_async_connection().await {
        Ok(mut conn) => match redis::cmd("PING").query_async::<String>(&mut conn).await {
            Ok(reply) if reply == "PONG" => "connected",
            _ => "disconnected",
        },
        Err(_) => "disconnected",
    };

    // UDG Webhook connectivity test (non-blocking, won't fail health check)
    let udg_webhook_status = {
        let url = &state.config.udg_webhook_url;
        if url.is_empty() {
            "not_configured"
        } else {
            match state
                .http_client
                .head(url)
                .timeout(std::time::Duration::from_secs(5))
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() || resp.status().is_redirection() => "ok",
                Ok(_) => "reachable",
                Err(_) => "unreachable",
            }
        }
    };

    let latency_ms = start.elapsed().as_millis();

    let overall = if db_status == "connected" && redis_status == "connected" {
        "ok"
    } else {
        "degraded"
    };

    Json(serde_json::json!({
        "status": overall,
        "db": db_status,
        "redis": redis_status,
        "udg_webhook": udg_webhook_status,
        "latency_ms": latency_ms,
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
