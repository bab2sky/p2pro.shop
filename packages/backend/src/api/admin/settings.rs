//! System settings, admin logs, email logs

use axum::{
    extract::{Query, State},
    Extension, Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::domain::admin::*;
use crate::domain::common::Pagination;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

// --- Admin Logs ---

pub async fn list_logs(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<AdminLogListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    // FR-08: Single query with COUNT(*) OVER()
    let logs = sqlx::query_as::<_, AdminLogEntry>(
        r#"SELECT id, admin_id, action, target_type, target_id, details, ip_address::TEXT as ip_address, created_at,
                  COUNT(*) OVER() as total_count
           FROM admin_logs
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(per_page).bind(offset)
    .fetch_all(&state.db).await?;

    let total = logs.first().and_then(|l| l.total_count).unwrap_or(0);

    Ok(Json(AdminLogListResponse {
        data: logs,
        pagination: Pagination::new(page, per_page, total),
    }))
}

// --- System Settings ---

pub async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT key, value FROM system_settings ORDER BY key",
    )
    .fetch_all(&state.db)
    .await?;

    let sensitive_keys = ["chatbot_api_key"];

    let settings: serde_json::Map<String, serde_json::Value> = rows
        .into_iter()
        .map(|(k, v)| {
            let masked = if sensitive_keys.contains(&k.as_str()) && v.len() > 4 {
                format!("****{}", &v[v.len() - 4..])
            } else if sensitive_keys.contains(&k.as_str()) && !v.is_empty() {
                "****".to_string()
            } else {
                v
            };
            (k, serde_json::Value::String(masked))
        })
        .collect();

    Ok(Json(json!({ "data": settings })))
}

pub async fn update_settings(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let allowed_keys = [
        // 거래 설정
        "commission_rate",
        "auto_confirm_days",
        "txid_timeout_hours",
        "min_withdrawal",
        "withdrawal_fee_rate",
        "dispute_deadline_days",
        // USDT 지갑 설정
        "usdt_wallet_network",
        "usdt_wallet_address",
        "company_wallet_address",
        "company_wallet_eth",
        "company_wallet_tron",
        // 약관/정책
        "terms_of_service",
        "privacy_policy",
        // 회사소개
        "about_page",
        // AI 챗봇
        "chatbot_provider",
        "chatbot_api_key",
        "chatbot_model",
        "chatbot_system_prompt",
        "chatbot_ollama_url",
    ];

    // LOW backlog (Audit Admin M-1): old values 를 미리 fetch 해서 audit log 에
    // before/after 모두 기록. compliance (수수료율 변경 추적, 정산 reconciliation 등) 필수.
    let keys_to_change: Vec<String> = req.keys().cloned().collect();
    let old_values: std::collections::HashMap<String, String> =
        sqlx::query_as::<_, (String, String)>(
            "SELECT key, value FROM system_settings WHERE key = ANY($1)",
        )
        .bind(&keys_to_change)
        .fetch_all(&state.db)
        .await?
        .into_iter()
        .collect();

    for (key, value) in &req {
        if !allowed_keys.contains(&key.as_str()) {
            return Err(AppError::Validation {
                message: format!("Unknown setting key: {}", key),
                field: Some("key".into()),
            });
        }

        // Validate numeric settings
        match key.as_str() {
            "commission_rate" | "withdrawal_fee_rate" => {
                let v: f64 = value.parse().map_err(|_| AppError::Validation {
                    message: format!("{} must be a valid number", key),
                    field: Some(key.clone()),
                })?;
                if !(0.0..=1.0).contains(&v) {
                    return Err(AppError::Validation {
                        message: format!("{} must be between 0.0 and 1.0", key),
                        field: Some(key.clone()),
                    });
                }
            }
            "min_withdrawal" => {
                let v: f64 = value.parse().map_err(|_| AppError::Validation {
                    message: "min_withdrawal must be a valid number".into(),
                    field: Some(key.clone()),
                })?;
                if v < 0.0 {
                    return Err(AppError::Validation {
                        message: "min_withdrawal must be >= 0".into(),
                        field: Some(key.clone()),
                    });
                }
            }
            "usdt_wallet_network" if !["TRC20", "BEP20", "ERC20"].contains(&value.as_str()) => {
                return Err(AppError::Validation {
                    message: "Network must be TRC20, BEP20, or ERC20".into(),
                    field: Some(key.clone()),
                });
            }
            _ => {}
        }

        sqlx::query(
            "INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
        )
        .bind(key).bind(value)
        .execute(&state.db).await?;
    }

    // 변경 사항 (before/after) 을 명시적으로 기록.
    let changes: Vec<serde_json::Value> = req
        .iter()
        .map(|(k, new_v)| {
            json!({
                "key": k,
                "old": old_values.get(k),
                "new": new_v,
            })
        })
        .collect();

    let _ = crate::domain::admin::log_admin_action(
        &state.db,
        auth.id,
        "settings_update",
        "system",
        Uuid::nil(),
        Some(json!({ "changes": &changes })),
        None,
    )
    .await;
    let _ = crate::domain::admin::log_audit_action(
        &state.db,
        auth.id,
        "settings_update",
        "system",
        None,
        Some(json!({ "changes": &changes })),
        None,
    )
    .await;

    Ok(Json(json!({ "data": { "updated": true } })))
}

// --- Audit Logs (FR-28) ---

pub async fn list_audit_logs(
    State(state): State<AppState>,
    Query(params): Query<crate::domain::admin::AuditLogSearchParams>,
) -> Result<Json<crate::domain::admin::AuditLogListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let logs = sqlx::query_as::<_, crate::domain::admin::AuditLogEntry>(
        r#"SELECT al.id, al.admin_id,
                  COALESCE(u.nickname, u.real_name, u.username) as admin_name,
                  al.action, al.target_type, al.target_id,
                  al.details, al.ip_address, al.created_at,
                  COUNT(*) OVER() as total_count
           FROM audit_logs al
           JOIN users u ON u.id = al.admin_id
           WHERE ($1::text IS NULL OR al.action = $1)
             AND ($2::uuid IS NULL OR al.admin_id = $2)
             AND ($3::text IS NULL OR al.created_at >= $3::timestamptz)
             AND ($4::text IS NULL OR al.created_at <= $4::timestamptz)
           ORDER BY al.created_at DESC
           LIMIT $5 OFFSET $6"#,
    )
    .bind(&params.action)
    .bind(params.admin_id)
    .bind(&params.date_from)
    .bind(&params.date_to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = logs.first().and_then(|l| l.total_count).unwrap_or(0);

    Ok(Json(crate::domain::admin::AuditLogListResponse {
        data: logs,
        pagination: Pagination::new(page, per_page, total),
    }))
}

// --- Email Logs ---

pub async fn list_email_logs(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    // FR-08: Single query with COUNT(*) OVER()
    let logs = sqlx::query_as::<_, (Uuid, Option<Uuid>, String, String, String, String, i32, Option<chrono::DateTime<chrono::Utc>>, chrono::DateTime<chrono::Utc>, Option<i64>)>(
        r#"SELECT id, user_id, template_key, email_to, subject, status, attempts, sent_at, created_at,
                  COUNT(*) OVER() as total_count
           FROM email_logs
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(per_page).bind(offset)
    .fetch_all(&state.db).await?;

    let total = logs.first().and_then(|l| l.9).unwrap_or(0);

    let data: Vec<serde_json::Value> = logs
        .into_iter()
        .map(
            |(
                id,
                user_id,
                template_key,
                email_to,
                subject,
                status,
                attempts,
                sent_at,
                created_at,
                _,
            )| {
                json!({
                    "id": id, "user_id": user_id, "template_key": template_key,
                    "email_to": email_to, "subject": subject, "status": status,
                    "attempts": attempts, "sent_at": sent_at, "created_at": created_at,
                })
            },
        )
        .collect();

    Ok(Json(json!({
        "data": data,
        "pagination": Pagination::new(page, per_page, total),
    })))
}
