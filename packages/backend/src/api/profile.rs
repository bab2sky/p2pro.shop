use axum::{
    extract::{Path, State},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::domain::profile::*;
use crate::middleware::auth::AuthUser;
use crate::middleware::totp;
use crate::{AppError, AppState};

/// Profile routes — all protected (auth_middleware applied in mod.rs)
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_profile).put(update_profile))
        .route("/password", put(change_password))
        .route("/totp/setup", post(totp_setup))
        .route("/totp/verify", post(totp_verify))
        .route("/totp", delete(totp_disable))
        .route("/wallets", get(list_wallets).post(add_wallet))
        .route("/wallets/change-request", post(wallet_change_request))
        .route("/wallets/{id}", delete(remove_wallet))
        .route("/notifications", put(update_notifications))
        .route("/email-settings", put(update_email_settings))
        .route("/social-logins", get(list_social_logins))
        .route("/deactivate", post(deactivate_account))
}

// --- GET /api/profile ---

async fn get_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let profile = sqlx::query_as::<_, UserProfile>(
        r#"SELECT u.id, u.email, u.nickname, u.profile_image, u.role,
                  u.account_status, u.notification_settings,
                  COALESCE(t.is_enabled, false) as totp_enabled,
                  u.referral_code,
                  COALESCE((SELECT COUNT(*) FROM users r WHERE r.referrer_id = u.id), 0) as referral_count,
                  u.created_at, u.updated_at
           FROM users u
           LEFT JOIN user_totp t ON t.user_id = u.id
           WHERE u.id = $1"#,
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(json!({ "data": profile })))
}

// --- PUT /api/profile ---

async fn update_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<ProfileUpdateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query(
        r#"UPDATE users SET
           nickname = COALESCE($2, nickname),
           profile_image = COALESCE($3, profile_image),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(auth.id)
    .bind(&req.nickname)
    .bind(&req.profile_image)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "data": { "updated": true } })))
}

// --- PUT /api/profile/password ---

async fn change_password(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<PasswordChangeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-09: 비밀번호 복잡도 검증 (대/소/숫/특 중 3가지 이상)
    crate::api::auth::validate_password_complexity(&req.new_password)?;

    let current_hash =
        sqlx::query_scalar::<_, String>("SELECT password_hash FROM users WHERE id = $1")
            .bind(auth.id)
            .fetch_one(&state.db)
            .await?;

    // M-4: Use shared verify_password / hash_password from auth module
    if !crate::api::auth::verify_password(&req.current_password, &current_hash)? {
        return Err(AppError::Unauthorized(
            "Current password is incorrect".into(),
        ));
    }

    let new_hash = crate::api::auth::hash_password(&req.new_password)?;

    sqlx::query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1")
        .bind(auth.id)
        .bind(&new_hash)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "data": { "updated": true } })))
}

// --- POST /api/profile/totp/setup ---

async fn totp_setup(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check if TOTP already enabled
    let existing = sqlx::query_scalar::<_, Option<bool>>(
        "SELECT is_enabled FROM user_totp WHERE user_id = $1",
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(Some(true)) = existing {
        return Err(AppError::Conflict("2FA is already enabled".into()));
    }

    let email = sqlx::query_scalar::<_, String>("SELECT email FROM users WHERE id = $1")
        .bind(auth.id)
        .fetch_one(&state.db)
        .await?;

    let (secret_base32, qr_url) = totp::generate_totp_secret(&state.config.totp_issuer, &email)?;

    let encrypted_secret =
        totp::encrypt_totp_secret(&secret_base32, &state.config.totp_encryption_key)?;

    let plaintext_codes = totp::generate_backup_codes(5);

    let mut hashed_codes: Vec<String> = Vec::new();
    for code in &plaintext_codes {
        let hash = totp::hash_backup_code(code)?;
        hashed_codes.push(hash);
    }

    sqlx::query(
        r#"INSERT INTO user_totp (id, user_id, secret_encrypted, is_enabled, backup_codes)
           VALUES ($1, $2, $3, false, $4)
           ON CONFLICT (user_id) DO UPDATE SET
               secret_encrypted = EXCLUDED.secret_encrypted,
               is_enabled = false,
               backup_codes = EXCLUDED.backup_codes,
               updated_at = NOW()"#,
    )
    .bind(Uuid::new_v4())
    .bind(auth.id)
    .bind(&encrypted_secret)
    .bind(&hashed_codes)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({
        "data": {
            "secret": secret_base32,
            "qr_url": qr_url,
            "backup_codes": plaintext_codes,
        }
    })))
}

// --- POST /api/profile/totp/verify ---

async fn totp_verify(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<TotpVerifyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let totp_record = sqlx::query_as::<_, UserTotp>(
        "SELECT id, user_id, secret_encrypted, is_enabled, backup_codes, created_at, updated_at FROM user_totp WHERE user_id = $1",
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Validation {
        message: "2FA setup not initiated. Call /api/profile/totp/setup first.".into(),
        field: None,
    })?;

    if totp_record.is_enabled == Some(true) {
        return Err(AppError::Conflict("2FA is already enabled".into()));
    }

    let secret_base32 = totp::decrypt_totp_secret(
        &totp_record.secret_encrypted,
        &state.config.totp_encryption_key,
    )?;

    let valid = totp::verify_totp_code(&secret_base32, &req.code)?;

    if !valid {
        return Err(AppError::Unauthorized("Invalid 2FA code".into()));
    }

    sqlx::query("UPDATE user_totp SET is_enabled = true, updated_at = NOW() WHERE user_id = $1")
        .bind(auth.id)
        .execute(&state.db)
        .await?;

    // FR-11: users.is_2fa_enabled 동기화
    sqlx::query("UPDATE users SET is_2fa_enabled = true, updated_at = NOW() WHERE id = $1")
        .bind(auth.id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "data": { "enabled": true } })))
}

// --- DELETE /api/profile/totp ---

async fn totp_disable(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<TotpVerifyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Use the consolidated verify_totp that checks DB, decrypts, and validates
    totp::verify_totp(
        &state.db,
        auth.id,
        &req.code,
        &state.config.totp_encryption_key,
    )
    .await?;

    sqlx::query("DELETE FROM user_totp WHERE user_id = $1")
        .bind(auth.id)
        .execute(&state.db)
        .await?;

    // FR-11: users.is_2fa_enabled 동기화
    sqlx::query("UPDATE users SET is_2fa_enabled = false, updated_at = NOW() WHERE id = $1")
        .bind(auth.id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "data": { "disabled": true } })))
}

// --- GET /api/profile/wallets ---

async fn list_wallets(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let wallets = sqlx::query_as::<_, UserWallet>(
        r#"SELECT id, user_id, label, network, address, is_default, created_at, updated_at
           FROM user_wallets
           WHERE user_id = $1
           ORDER BY created_at"#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "data": wallets })))
}

// --- POST /api/profile/wallets ---

async fn add_wallet(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<WalletCreateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let is_2fa_enabled =
        sqlx::query_scalar::<_, bool>("SELECT is_2fa_enabled FROM users WHERE id = $1")
            .bind(auth.id)
            .fetch_one(&state.db)
            .await?;

    if is_2fa_enabled {
        let code = req.totp_code.as_deref().unwrap_or("");
        if code.is_empty() {
            return Err(AppError::Validation {
                message: "2FA 코드가 필요합니다".into(),
                field: Some("totp_code".into()),
            });
        }
        totp::verify_totp(&state.db, auth.id, code, &state.config.totp_encryption_key).await?;
    }

    if req.network != "ERC20" && req.network != "TRC20" {
        return Err(AppError::Validation {
            message: "Network must be 'ERC20' or 'TRC20'".into(),
            field: Some("network".into()),
        });
    }

    if req.address.trim().is_empty() || req.address.len() < 10 {
        return Err(AppError::Validation {
            message: "Invalid wallet address".into(),
            field: Some("address".into()),
        });
    }

    let label = req.label.unwrap_or_else(|| "default".to_string());
    let id = Uuid::new_v4();

    let existing_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM user_wallets WHERE user_id = $1")
            .bind(auth.id)
            .fetch_one(&state.db)
            .await?;

    let is_default = existing_count == 0;

    sqlx::query(
        r#"INSERT INTO user_wallets (id, user_id, label, network, address, is_default)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(id)
    .bind(auth.id)
    .bind(&label)
    .bind(&req.network)
    .bind(&req.address)
    .bind(is_default)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("user_wallets_user_id_network_address_key") {
                return AppError::Conflict("This wallet address is already registered".into());
            }
        }
        AppError::Database(e)
    })?;

    Ok(Json(json!({
        "data": {
            "id": id,
            "label": label,
            "network": req.network,
            "address": req.address,
            "is_default": is_default,
        }
    })))
}

// --- DELETE /api/profile/wallets/:id ---

async fn remove_wallet(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(wallet_id): Path<Uuid>,
    Json(req): Json<WalletDeleteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    totp::verify_totp(
        &state.db,
        auth.id,
        &req.totp_code,
        &state.config.totp_encryption_key,
    )
    .await?;

    let result = sqlx::query("DELETE FROM user_wallets WHERE id = $1 AND user_id = $2")
        .bind(wallet_id)
        .bind(auth.id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Wallet not found".into()));
    }

    Ok(Json(json!({ "data": { "deleted": true } })))
}

// --- POST /api/profile/wallets/change-request ---

async fn wallet_change_request(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<WalletChangeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.name.trim().is_empty() {
        return Err(AppError::Validation {
            message: "이름을 입력해주세요".into(),
            field: Some("name".into()),
        });
    }
    if req.phone.trim().is_empty() {
        return Err(AppError::Validation {
            message: "휴대폰번호를 입력해주세요".into(),
            field: Some("phone".into()),
        });
    }
    if req.new_address.trim().is_empty() || req.new_address.len() < 10 {
        return Err(AppError::Validation {
            message: "변경할 지갑 주소를 입력해주세요".into(),
            field: Some("new_address".into()),
        });
    }

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO wallet_change_requests (id, user_id, name, phone, current_address, new_address, network)
           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(id)
    .bind(auth.id)
    .bind(req.name.trim())
    .bind(req.phone.trim())
    .bind(req.current_address.trim())
    .bind(req.new_address.trim())
    .bind(req.network.trim())
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "data": { "id": id, "status": "pending" } })))
}

// --- PUT /api/profile/notifications ---

async fn update_notifications(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<NotificationSettingsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let current = sqlx::query_scalar::<_, Option<serde_json::Value>>(
        "SELECT notification_settings FROM users WHERE id = $1",
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    let mut settings: serde_json::Value = current
        .unwrap_or_else(|| json!({"order": true, "chat": true, "shipping": true, "notice": true}));

    if let Some(order) = req.order {
        settings["order"] = json!(order);
    }
    if let Some(chat) = req.chat {
        settings["chat"] = json!(chat);
    }
    if let Some(shipping) = req.shipping {
        settings["shipping"] = json!(shipping);
    }
    if let Some(notice) = req.notice {
        settings["notice"] = json!(notice);
    }

    sqlx::query("UPDATE users SET notification_settings = $2, updated_at = NOW() WHERE id = $1")
        .bind(auth.id)
        .bind(&settings)
        .execute(&state.db)
        .await?;

    Ok(Json(
        json!({ "data": { "notification_settings": settings } }),
    ))
}

// --- PUT /api/profile/email-settings ---

#[derive(serde::Deserialize)]
struct EmailSettingsRequest {
    email_notify_order: Option<bool>,
    email_notify_payment: Option<bool>,
    email_notify_delivery: Option<bool>,
    email_notify_settlement: Option<bool>,
    email_notify_dispute: Option<bool>,
    email_notify_marketing: Option<bool>,
}

async fn update_email_settings(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<EmailSettingsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query(
        r#"UPDATE users SET
           email_notify_order = COALESCE($2, email_notify_order),
           email_notify_payment = COALESCE($3, email_notify_payment),
           email_notify_delivery = COALESCE($4, email_notify_delivery),
           email_notify_settlement = COALESCE($5, email_notify_settlement),
           email_notify_dispute = COALESCE($6, email_notify_dispute),
           email_notify_marketing = COALESCE($7, email_notify_marketing),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(auth.id)
    .bind(req.email_notify_order)
    .bind(req.email_notify_payment)
    .bind(req.email_notify_delivery)
    .bind(req.email_notify_settlement)
    .bind(req.email_notify_dispute)
    .bind(req.email_notify_marketing)
    .execute(&state.db)
    .await?;

    Ok(Json(
        json!({ "data": { "message": "Email preferences updated" } }),
    ))
}

// --- GET /api/profile/social-logins ---

async fn list_social_logins(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let logins = sqlx::query_as::<
        _,
        (
            String,
            Option<String>,
            Option<String>,
            chrono::DateTime<chrono::Utc>,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        r#"SELECT provider, provider_email, provider_name, linked_at, last_login_at
           FROM social_logins WHERE user_id = $1
           ORDER BY linked_at"#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<serde_json::Value> = logins
        .iter()
        .map(|l| {
            json!({
                "provider": l.0,
                "provider_email": l.1,
                "provider_name": l.2,
                "linked_at": l.3,
                "last_login_at": l.4,
            })
        })
        .collect();

    Ok(Json(json!({ "data": data })))
}

// --- POST /api/profile/deactivate ---

async fn deactivate_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<DeactivateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check if 2FA is enabled
    let totp_enabled = sqlx::query_scalar::<_, Option<bool>>(
        "SELECT is_enabled FROM user_totp WHERE user_id = $1",
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?
    .flatten()
    .unwrap_or(false);

    if totp_enabled {
        totp::verify_totp(
            &state.db,
            auth.id,
            &req.totp_code,
            &state.config.totp_encryption_key,
        )
        .await?;
    } else {
        // FR-23: 2FA 미설정 시 비밀번호 확인 필수
        let password = req.password.as_deref().unwrap_or("");
        if password.is_empty() {
            return Err(AppError::Validation {
                message: "Password is required when 2FA is not enabled".into(),
                field: Some("password".into()),
            });
        }
        let current_hash =
            sqlx::query_scalar::<_, String>("SELECT password_hash FROM users WHERE id = $1")
                .bind(auth.id)
                .fetch_one(&state.db)
                .await?;
        // W-1 FIX: Use shared verify_password for M-4 consolidation completeness
        if !crate::api::auth::verify_password(password, &current_hash)? {
            return Err(AppError::Unauthorized("Incorrect password".into()));
        }
    }

    // Check for active orders as buyer
    let active_orders = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM orders
           WHERE buyer_id = $1
           AND status NOT IN ('cancelled', 'delivered', 'refunded')"#,
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if active_orders > 0 {
        return Err(AppError::Validation {
            message: "Cannot deactivate account with active orders".into(),
            field: None,
        });
    }

    // Check for active orders as seller
    let seller_profile =
        sqlx::query_scalar::<_, Option<Uuid>>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    if let Some(sp_id) = seller_profile {
        let active_seller_orders = sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM orders
               WHERE seller_id = $1
               AND status NOT IN ('cancelled', 'delivered', 'refunded')"#,
        )
        .bind(sp_id)
        .fetch_one(&state.db)
        .await?;

        if active_seller_orders > 0 {
            return Err(AppError::Validation {
                message: "Cannot deactivate account with active seller orders".into(),
                field: None,
            });
        }
    }

    sqlx::query(
        r#"UPDATE users SET
           account_status = 'deactivating',
           deactivation_requested_at = NOW(),
           updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({
        "data": {
            "account_status": "deactivating",
            "message": "Account deactivation requested. Will be permanently deleted after 30 days."
        }
    })))
}
