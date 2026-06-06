use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::PgPool;
use uuid::Uuid;

use crate::AppState;

type HmacSha256 = Hmac<Sha256>;

/// Enqueue a webhook event for async delivery.
pub async fn enqueue_webhook(
    db: &PgPool,
    event_type: &str,
    payload: serde_json::Value,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();

    sqlx::query(
        r#"INSERT INTO webhook_events (id, event_type, payload, status, attempts)
           VALUES ($1, $2, $3, 'pending', 0)"#,
    )
    .bind(id)
    .bind(event_type)
    .bind(&payload)
    .execute(db)
    .await?;

    tracing::debug!("Webhook event enqueued: {} ({})", event_type, id);
    Ok(id)
}

/// Process pending webhook events from the database queue.
/// Called periodically by the scheduler.
pub async fn process_webhook_queue(state: &AppState) -> anyhow::Result<()> {
    let webhook_url = &state.config.udg_webhook_url;
    let webhook_secret = &state.config.udg_webhook_secret;
    let max_retries = state.config.webhook_max_retries;

    if webhook_url.is_empty() {
        return Ok(());
    }

    // Fetch pending events ready for processing
    let pending_events = sqlx::query_as::<_, (Uuid, String, serde_json::Value, i32)>(
        r#"SELECT id, event_type, payload, attempts
           FROM webhook_events
           WHERE status = 'pending'
           AND (next_retry_at IS NULL OR next_retry_at <= NOW())
           ORDER BY created_at ASC
           LIMIT 50"#,
    )
    .fetch_all(&state.db)
    .await?;

    if pending_events.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::new();

    for (event_id, event_type, payload, attempts) in pending_events {
        let result =
            send_webhook(&client, webhook_url, webhook_secret, &event_type, &payload).await;

        match result {
            Ok((status_code, body)) => {
                if (200..300).contains(&status_code) {
                    // Success
                    sqlx::query(
                        r#"UPDATE webhook_events SET
                           status = 'sent',
                           attempts = attempts + 1,
                           last_attempt_at = NOW(),
                           response_status = $2,
                           response_body = $3
                           WHERE id = $1"#,
                    )
                    .bind(event_id)
                    .bind(status_code)
                    .bind(&body)
                    .execute(&state.db)
                    .await?;

                    // FR-06: UDG confirmed webhook 성공 시 환불 차단
                    if event_type == "order.confirmed" {
                        if let Some(oid) = payload.get("order_id").and_then(|v| v.as_str()) {
                            if let Ok(oid) = Uuid::parse_str(oid) {
                                let _ = crate::domain::udg::block_refund_after_udg(&state.db, oid)
                                    .await;
                            }
                        }
                        // FR-10: distribution_id from response body
                        if let Ok(resp_json) = serde_json::from_str::<serde_json::Value>(&body) {
                            if let Some(dist_id) =
                                resp_json.get("distribution_id").and_then(|v| v.as_str())
                            {
                                if let Some(oid) = payload.get("order_id").and_then(|v| v.as_str())
                                {
                                    if let Ok(oid) = Uuid::parse_str(oid) {
                                        let _ = crate::domain::udg::save_distribution_id(
                                            &state.db, oid, dist_id,
                                        )
                                        .await;
                                    }
                                }
                            }
                        }
                    }

                    tracing::info!("Webhook sent successfully: {} ({})", event_type, event_id);
                } else {
                    handle_webhook_failure(
                        state,
                        event_id,
                        attempts,
                        max_retries,
                        Some(status_code),
                        &body,
                    )
                    .await?;
                }
            }
            Err(e) => {
                let error_msg = format!("Request error: {}", e);
                handle_webhook_failure(state, event_id, attempts, max_retries, None, &error_msg)
                    .await?;
            }
        }
    }

    Ok(())
}

async fn send_webhook(
    client: &reqwest::Client,
    url: &str,
    secret: &str,
    event_type: &str,
    payload: &serde_json::Value,
) -> Result<(i32, String), reqwest::Error> {
    let timestamp = chrono::Utc::now().timestamp().to_string();

    // UDGworld 서명 검증 포맷: HMAC(event.timestamp.JSON(data))
    let data_str = payload.to_string();
    let sign_payload = format!("{}.{}.{}", event_type, timestamp, data_str);
    let signature = compute_hmac_signature(secret, &sign_payload);

    // UDGworld WebhookPayload 포맷: { event, data, timestamp, signature }
    let full_payload = serde_json::json!({
        "event": event_type,
        "data": payload,
        "timestamp": timestamp,
        "signature": signature,
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&full_payload)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await?;

    let status = response.status().as_u16() as i32;
    let body = response.text().await.unwrap_or_default();

    Ok((status, body))
}

fn compute_hmac_signature(secret: &str, payload: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

async fn handle_webhook_failure(
    state: &AppState,
    event_id: Uuid,
    current_attempts: i32,
    max_retries: u32,
    response_status: Option<i32>,
    response_body: &str,
) -> anyhow::Result<()> {
    let new_attempts = current_attempts + 1;

    if new_attempts as u32 >= max_retries {
        // Move to DLQ
        sqlx::query(
            r#"UPDATE webhook_events SET
               status = 'dlq',
               attempts = $2,
               last_attempt_at = NOW(),
               response_status = $3,
               response_body = $4
               WHERE id = $1"#,
        )
        .bind(event_id)
        .bind(new_attempts)
        .bind(response_status)
        .bind(response_body)
        .execute(&state.db)
        .await?;

        tracing::error!(
            "Webhook moved to DLQ after {} attempts: {}",
            new_attempts,
            event_id
        );

        // Notify admins
        let admin_ids: Vec<Uuid> =
            sqlx::query_scalar("SELECT id FROM users WHERE role = 'admin' LIMIT 5")
                .fetch_all(&state.db)
                .await?;

        for admin_id in admin_ids {
            let _ = crate::domain::notification::create_notification(
                &state.db,
                Some(&state.ws_hub),
                admin_id,
                "system",
                "Webhook DLQ Alert",
                &format!(
                    "Webhook event {} failed after {} attempts and moved to DLQ.",
                    event_id, new_attempts
                ),
                None,
            )
            .await;
        }
    } else {
        // Calculate next retry with exponential backoff
        // Retry schedule: 1min, 5min, 30min, 2h, 6h
        let delay_seconds = match new_attempts {
            1 => 60,    // 1 min
            2 => 300,   // 5 min
            3 => 1800,  // 30 min
            4 => 7200,  // 2 hours
            _ => 21600, // 6 hours
        };

        sqlx::query(
            r#"UPDATE webhook_events SET
               attempts = $2,
               last_attempt_at = NOW(),
               next_retry_at = NOW() + make_interval(secs => $3::int),
               response_status = $4,
               response_body = $5
               WHERE id = $1"#,
        )
        .bind(event_id)
        .bind(new_attempts)
        .bind(delay_seconds as f64)
        .bind(response_status)
        .bind(response_body)
        .execute(&state.db)
        .await?;

        tracing::warn!(
            "Webhook failed (attempt {}), retrying in {}s: {}",
            new_attempts,
            delay_seconds,
            event_id
        );
    }

    Ok(())
}
