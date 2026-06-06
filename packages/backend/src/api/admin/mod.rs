//! Admin API module — split from original 1194-line admin.rs
//! Sub-modules organized by domain responsibility.

mod categories;
mod dashboard;
mod finance;
mod moderation;
mod profit;
mod settings;

use axum::{
    extract::ConnectInfo,
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;

use crate::AppState;

/// Read-only admin routes (GET endpoints) — rate limited at 30/min per IP
pub fn read_router() -> Router<AppState> {
    Router::new()
        .route("/dashboard", get(dashboard::dashboard))
        .route("/products", get(moderation::list_admin_products))
        .route("/products/pending", get(moderation::pending_products))
        .route("/products/stats", get(moderation::product_stats))
        .route("/txid/pending", get(moderation::pending_txids))
        .route("/sellers", get(moderation::list_sellers))
        .route("/sellers/stats", get(moderation::seller_stats))
        .route("/users", get(moderation::list_users))
        .route("/users/stats", get(moderation::user_stats))
        .route("/users/{id}", get(moderation::get_user))
        .route("/categories", get(categories::list_categories))
        .route("/logs", get(settings::list_logs))
        .route("/withdrawals", get(finance::list_withdrawals))
        .route("/withdrawals/stats", get(finance::withdrawal_stats))
        .route("/orders", get(finance::admin_list_orders))
        .route("/orders/stats", get(finance::admin_order_stats))
        .route("/orders/export", get(finance::admin_export_orders))
        .route("/orders/{id}", get(finance::admin_get_order))
        .route("/disputes", get(finance::admin_list_disputes))
        .route("/disputes/stats", get(finance::admin_dispute_stats))
        .route("/disputes/{id}", get(finance::admin_get_dispute))
        .route("/settings", get(settings::get_settings))
        .route("/email-logs", get(settings::list_email_logs))
        .route("/audit-logs", get(settings::list_audit_logs))
        .route("/reviews", get(moderation::list_admin_reviews))
        .route("/reviews/stats", get(moderation::review_stats))
        .route("/reviews/low-rated", get(moderation::low_rated_products))
        .route("/shipping", get(moderation::list_admin_shipments))
        .route("/shipping/stats", get(moderation::shipping_stats))
        .route("/shipping/overdue", get(moderation::overdue_shipments))
        .route(
            "/shipping/sellers",
            get(moderation::seller_shipping_performance),
        )
        .route("/refunds", get(finance::admin_list_refunds))
        .route("/refunds/stats", get(finance::admin_refund_stats))
        .route("/udg/events", get(finance::admin_list_udg_events))
        .route("/udg/stats", get(finance::admin_udg_stats))
        .route(
            "/chat/{order_id}/messages",
            get(moderation::admin_chat_messages),
        )
        .merge(profit::admin_profit_router())
        .route("/time-deals", get(super::analytics::admin_list_time_deals))
}

/// Write admin routes (PUT/POST/DELETE endpoints) — rate limited at 10/min per IP
pub fn write_router() -> Router<AppState> {
    Router::new()
        .route(
            "/sellers/{id}/status",
            put(moderation::update_seller_status),
        )
        .route(
            "/sellers/{id}/wallet",
            put(moderation::update_seller_wallet),
        )
        .route("/products/{id}/approve", put(moderation::approve_product))
        .route("/products/{id}/reject", put(moderation::reject_product))
        .route("/products/{id}/suspend", put(moderation::suspend_product))
        .route("/products/{id}/restore", put(moderation::restore_product))
        .route("/txid/{id}/verify", put(moderation::verify_txid))
        .route("/users/{id}", put(moderation::update_user))
        .route("/users/{id}/block", put(moderation::block_user))
        .route("/categories", post(categories::create_category))
        .route("/categories/{id}", put(categories::update_category))
        .route("/categories/{id}", delete(categories::delete_category))
        .route("/categories/reorder", put(categories::reorder_categories))
        .route("/categories/{id}/move", put(categories::move_category))
        .route(
            "/categories/{id}/toggle-active",
            put(categories::toggle_category_active),
        )
        .route(
            "/withdrawals/{id}/process",
            put(finance::process_withdrawal),
        )
        .route(
            "/disputes/{id}/resolve",
            post(finance::admin_resolve_dispute),
        )
        .route("/settings", put(settings::update_settings))
        .route("/reviews/{id}/hide", put(moderation::hide_review))
        .route("/reviews/{id}", delete(moderation::delete_review))
        .route("/refunds/{id}/process", put(finance::admin_process_refund))
        .route("/chatbot/test", post(chatbot_test))
        .route(
            "/time-deals/{id}/approve",
            put(super::analytics::admin_approve_time_deal),
        )
        .route(
            "/time-deals/{id}/reject",
            put(super::analytics::admin_reject_time_deal),
        )
        .route(
            "/sellers/{id}/verify-deposit",
            put(moderation::verify_seller_deposit),
        )
        .route(
            "/sellers/{id}/refund-deposit",
            put(moderation::refund_seller_deposit),
        )
        .route("/udg/backfill-phones", post(backfill_udg_phones))
}

/// POST /admin/chatbot/test — test LLM connection
async fn chatbot_test(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Result<axum::Json<serde_json::Value>, crate::AppError> {
    match crate::domain::llm::test_llm_connection(&state.db).await {
        Ok(reply) => Ok(axum::Json(serde_json::json!({
            "data": { "success": true, "reply": reply }
        }))),
        Err(e) => Ok(axum::Json(serde_json::json!({
            "data": { "success": false, "error": e.to_string() }
        }))),
    }
}

/// POST /admin/udg/backfill-phones — udg 회원 전체에 대해 phone 동기화 이벤트 enqueue.
///
/// 일회성 백필 용도. udg 도메인에 phone 컬럼이 새로 생긴 직후 기존 회원들의
/// phone 을 한 번에 채우기 위해 사용. fire-and-forget 으로 즉시 응답하고
/// enqueue/dispatch 는 백그라운드에서 진행 (회원 수가 많을 때 timeout 방지).
///
/// 멱등: 같은 회원에 대해 여러 번 enqueue 해도 udg 쪽이 같은 결과로 수렴.
async fn backfill_udg_phones(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Result<axum::Json<serde_json::Value>, crate::AppError> {
    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_udg_member = TRUE")
            .fetch_one(&state.db)
            .await?;

    let state_bg = state.clone();
    tokio::spawn(async move {
        let rows: Vec<(uuid::Uuid, Option<String>)> = match sqlx::query_as(
            "SELECT id, phone FROM users WHERE is_udg_member = TRUE",
        )
        .fetch_all(&state_bg.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::error!("backfill_udg_phones SELECT failed: {}", e);
                return;
            }
        };

        let mut enqueued = 0usize;
        for (user_id, phone) in &rows {
            match crate::domain::udg::enqueue_udg_user_updated(
                &state_bg.db,
                *user_id,
                phone.as_deref(),
            )
            .await
            {
                Ok(_) => enqueued += 1,
                Err(e) => tracing::warn!(
                    "backfill_udg_phones enqueue failed for user {}: {}",
                    user_id,
                    e
                ),
            }
        }

        tracing::info!(
            "backfill_udg_phones: enqueued {} of {} udg members",
            enqueued,
            rows.len()
        );

        if let Err(e) = crate::scheduler::webhook::process_webhook_queue(&state_bg).await {
            tracing::warn!(
                "backfill_udg_phones dispatch failed (scheduler will retry): {}",
                e
            );
        }
    });

    Ok(axum::Json(serde_json::json!({
        "data": { "status": "started", "total_udg_members": total }
    })))
}

/// m-6: Escape LIKE/ILIKE wildcards to prevent SQL pattern injection
pub fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// Build a search pattern with escaped LIKE wildcards
pub fn search_pattern(search: &str) -> String {
    if search.is_empty() {
        "%".to_string()
    } else {
        format!("%{}%", escape_like(search))
    }
}

/// Extract client IP from X-Forwarded-For header or ConnectInfo fallback
pub fn extract_ip(
    headers: &axum::http::HeaderMap,
    connect_info: Option<&ConnectInfo<SocketAddr>>,
) -> Option<String> {
    if let Some(forwarded) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(ip) = forwarded.split(',').next().map(|s| s.trim().to_string()) {
            if !ip.is_empty() {
                return Some(ip);
            }
        }
    }
    connect_info.map(|ci| ci.0.ip().to_string())
}
