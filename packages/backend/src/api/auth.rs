use axum::{extract::State, routing::post, Json, Router};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::domain::email::{queue_email, queue_email_direct, EmailTemplate};
use crate::domain::user::{AuthData, AuthResponse, LoginRequest, SignupRequest, UserProfile};
use crate::middleware::auth::{Claims, JWT_AUDIENCE, JWT_ISSUER};
use crate::{AppError, AppState};

// m-9: Security constants extracted from magic numbers
const LOGIN_MAX_ATTEMPTS: u32 = 5;
const LOGIN_LOCKOUT_SECS: u64 = 1800; // 30 minutes
const MAX_REFRESH_TOKENS_PER_USER: i64 = 5;

// Email verification constants
const EMAIL_VERIFY_CODE_TTL: u64 = 300; // 5 minutes
const EMAIL_VERIFY_TOKEN_TTL: u64 = 1800; // 30 minutes
const EMAIL_VERIFY_RATE_LIMIT_MAX: u32 = 3;
const EMAIL_VERIFY_RATE_LIMIT_WINDOW: u64 = 600; // 10 minutes

/// Check if user is locked out due to brute-force attempts
pub async fn check_brute_force(
    redis: &redis::Client,
    key_prefix: &str,
    identifier: &str,
    max_attempts: u32,
    lockout_secs: u64,
) -> Result<(), crate::AppError> {
    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|_| {
            crate::AppError::Internal(anyhow::anyhow!("Rate limit service unavailable"))
        })?;
    let fail_key = format!("{}:{}", key_prefix, identifier);
    let count: Option<u32> = redis::cmd("GET")
        .arg(&fail_key)
        .query_async(&mut conn)
        .await
        .ok()
        .flatten();
    if count.unwrap_or(0) >= max_attempts {
        return Err(crate::AppError::RateLimited {
            retry_after: lockout_secs,
        });
    }
    Ok(())
}

/// Increment failure count after wrong password/code
pub async fn increment_fail(
    redis: &redis::Client,
    key_prefix: &str,
    identifier: &str,
    lockout_secs: u64,
) {
    if let Ok(mut conn) = redis.get_multiplexed_async_connection().await {
        let fail_key = format!("{}:{}", key_prefix, identifier);
        let _: Option<()> = redis::cmd("INCR")
            .arg(&fail_key)
            .query_async(&mut conn)
            .await
            .ok();
        let _: Option<()> = redis::cmd("EXPIRE")
            .arg(&fail_key)
            .arg(lockout_secs)
            .query_async(&mut conn)
            .await
            .ok();
    }
}

/// Reset failure count on successful login
pub async fn reset_fail(redis: &redis::Client, key_prefix: &str, identifier: &str) {
    if let Ok(mut conn) = redis.get_multiplexed_async_connection().await {
        let fail_key = format!("{}:{}", key_prefix, identifier);
        let _: Option<()> = redis::cmd("DEL")
            .arg(&fail_key)
            .query_async(&mut conn)
            .await
            .ok();
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/signup", post(signup))
        .route("/login", post(login))
        .route("/login-2fa", post(login_2fa))
        .route("/refresh", post(refresh_token))
        .route("/reset-password", post(reset_password))
        .route("/send-verification", post(send_verification))
        .route("/verify-email", post(verify_email))
}

/// 가입 enumeration 방어용 별도 라우터.
///
/// /check-email, /check-phone, /check-referrer 는 가입 폼 자동검증 용도로
/// 비인증 호출 가능하다. 이전엔 auth_login (5/min/IP) 와 한 묶음이라 14일이면
/// 100K 이메일 enumeration 가능했음 (privacy 침해). 별도 stricter rate limit
/// (auth_enumeration, 1/min/IP) 로 분리.
pub fn enumeration_router() -> Router<AppState> {
    Router::new()
        .route("/check-referrer", post(check_referrer))
        .route("/check-email", post(check_email))
        .route("/check-phone", post(check_phone))
}

#[derive(serde::Deserialize)]
struct CheckEmailRequest {
    email: String,
}

async fn check_email(
    State(state): State<AppState>,
    Json(req): Json<CheckEmailRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate email format
    use validator::ValidateEmail;
    if !req.email.validate_email() {
        return Err(AppError::Validation {
            message: "Invalid email format".into(),
            field: Some("email".into()),
        });
    }

    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
            .bind(&req.email)
            .fetch_one(&state.db)
            .await?;

    // Constant-time delay on both paths to prevent timing-based enumeration
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    if exists {
        Ok(Json(serde_json::json!({
            "data": { "available": false }
        })))
    } else {
        Ok(Json(serde_json::json!({
            "data": { "available": true }
        })))
    }
}

#[derive(serde::Deserialize)]
struct CheckPhoneRequest {
    phone: String,
}

async fn check_phone(
    State(state): State<AppState>,
    Json(req): Json<CheckPhoneRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let normalized = req.phone.trim().to_string();
    // E.164 기본 검증: '+' 로 시작하고 8~16자 (+ 포함)
    if !normalized.starts_with('+') || normalized.len() < 8 || normalized.len() > 16 {
        return Err(AppError::Validation {
            message: "Invalid phone format".into(),
            field: Some("phone".into()),
        });
    }
    let digits: String = normalized
        .chars()
        .skip(1)
        .filter(|c| c.is_ascii_digit())
        .collect();
    if digits.len() < 7 || digits.len() > 15 {
        return Err(AppError::Validation {
            message: "Invalid phone number length".into(),
            field: Some("phone".into()),
        });
    }

    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE phone = $1)")
            .bind(&normalized)
            .fetch_one(&state.db)
            .await?;

    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    Ok(Json(serde_json::json!({
        "data": { "available": !exists }
    })))
}

#[derive(serde::Deserialize)]
struct CheckReferrerRequest {
    code: String,
}

async fn check_referrer(
    State(state): State<AppState>,
    Json(req): Json<CheckReferrerRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Referral code lookup uses 8-digit numeric code.
    // Rate-limited at route level via ip_rate_limit_middleware to mitigate enumeration.
    let user = sqlx::query_as::<_, (String,)>(
        "SELECT COALESCE(nickname, username) FROM users WHERE referral_code = $1",
    )
    .bind(&req.code)
    .fetch_optional(&state.db)
    .await?;

    // Constant-time delay on both paths to prevent timing-based enumeration
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    match user {
        Some((name,)) => {
            // Mask the nickname: show first char + asterisks (e.g., "john" -> "j***")
            let masked = if name.len() <= 1 {
                "***".to_string()
            } else {
                let first: String = name.chars().take(1).collect();
                format!("{}***", first)
            };
            Ok(Json(serde_json::json!({
                "data": { "valid": true, "nickname": masked }
            })))
        }
        None => Ok(Json(serde_json::json!({
            "data": { "valid": false }
        }))),
    }
}

/// Forgot-password route with dedicated 3/min IP rate limit
pub fn forgot_password_router() -> Router<AppState> {
    Router::new().route("/auth/forgot-password", post(forgot_password))
}

#[derive(serde::Deserialize)]
struct SendVerificationRequest {
    email: String,
}

async fn send_verification(
    State(state): State<AppState>,
    Json(req): Json<SendVerificationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate email format
    use validator::ValidateEmail;
    if !req.email.validate_email() {
        return Err(AppError::Validation {
            message: "Invalid email format".into(),
            field: Some("email".into()),
        });
    }

    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Rate limit service unavailable")))?;

    // Rate limit: max 3 sends per email per 10 minutes
    let rate_key = format!("email_verify_rate:{}", &req.email);
    let count: Option<u32> = redis::cmd("GET")
        .arg(&rate_key)
        .query_async(&mut conn)
        .await
        .ok()
        .flatten();
    if count.unwrap_or(0) >= EMAIL_VERIFY_RATE_LIMIT_MAX {
        return Err(AppError::RateLimited {
            retry_after: EMAIL_VERIFY_RATE_LIMIT_WINDOW,
        });
    }

    // Generate 6-digit random code
    use rand::Rng;
    let code: String = format!("{:06}", rand::thread_rng().gen_range(0..1_000_000u32));

    // Store code in Redis with 5 min TTL
    let code_key = format!("email_verify:{}", &req.email);
    let _: Option<()> = redis::cmd("SET")
        .arg(&code_key)
        .arg(&code)
        .arg("EX")
        .arg(EMAIL_VERIFY_CODE_TTL)
        .query_async(&mut conn)
        .await
        .ok();

    // Increment rate limit counter
    let _: Option<()> = redis::cmd("INCR")
        .arg(&rate_key)
        .query_async(&mut conn)
        .await
        .ok();
    let _: Option<()> = redis::cmd("EXPIRE")
        .arg(&rate_key)
        .arg(EMAIL_VERIFY_RATE_LIMIT_WINDOW)
        .query_async(&mut conn)
        .await
        .ok();

    // Queue verification email
    let _ = queue_email_direct(
        &state.db,
        &req.email,
        EmailTemplate::EmailVerification { code },
    )
    .await;

    Ok(Json(serde_json::json!({
        "data": { "message": "인증 코드가 발송되었습니다." }
    })))
}

#[derive(serde::Deserialize)]
struct VerifyEmailRequest {
    email: String,
    code: String,
}

async fn verify_email(
    State(state): State<AppState>,
    Json(req): Json<VerifyEmailRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Verification service unavailable")))?;

    let code_key = format!("email_verify:{}", &req.email);
    let stored_code: Option<String> = redis::cmd("GET")
        .arg(&code_key)
        .query_async(&mut conn)
        .await
        .ok()
        .flatten();

    let Some(stored) = stored_code else {
        return Err(AppError::Validation {
            message: "인증 코드가 만료되었거나 존재하지 않습니다.".into(),
            field: Some("code".into()),
        });
    };

    // Timing-safe comparison
    use subtle::ConstantTimeEq;
    let is_equal = stored.as_bytes().ct_eq(req.code.as_bytes());
    if !bool::from(is_equal) {
        return Err(AppError::Validation {
            message: "인증 코드가 일치하지 않습니다.".into(),
            field: Some("code".into()),
        });
    }

    // Store verification token in Redis with 30 min TTL
    let verified_key = format!("email_verified:{}", &req.email);
    let _: Option<()> = redis::cmd("SET")
        .arg(&verified_key)
        .arg("1")
        .arg("EX")
        .arg(EMAIL_VERIFY_TOKEN_TTL)
        .query_async(&mut conn)
        .await
        .ok();

    // Delete the code key
    let _: Option<()> = redis::cmd("DEL")
        .arg(&code_key)
        .query_async(&mut conn)
        .await
        .ok();

    Ok(Json(serde_json::json!({
        "data": { "verified": true }
    })))
}

async fn signup(
    State(state): State<AppState>,
    Json(req): Json<SignupRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // Validate terms agreement
    if !req.terms_agreed || !req.privacy_agreed {
        return Err(AppError::Validation {
            message: "Terms and privacy agreement is required".into(),
            field: Some("terms_agreed".into()),
        });
    }

    // Validate email format using validator crate
    use validator::ValidateEmail;
    if !req.email.validate_email() {
        return Err(AppError::Validation {
            message: "Invalid email format".into(),
            field: Some("email".into()),
        });
    }

    // Validate password complexity: min 8 chars, at least 3 of 4 categories
    // (uppercase, lowercase, digit, special character)
    validate_password_complexity(&req.password)?;

    // Check email verification status in Redis
    {
        let mut conn = state
            .redis
            .get_multiplexed_async_connection()
            .await
            .map_err(|_| AppError::Internal(anyhow::anyhow!("Verification service unavailable")))?;
        let verified_key = format!("email_verified:{}", &req.email);
        let is_verified: Option<String> = redis::cmd("GET")
            .arg(&verified_key)
            .query_async(&mut conn)
            .await
            .ok()
            .flatten();
        if is_verified.is_none() {
            return Err(AppError::Validation {
                message: "이메일 인증이 필요합니다".into(),
                field: Some("email".into()),
            });
        }
    }

    // Check duplicate email
    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
            .bind(&req.email)
            .fetch_one(&state.db)
            .await?;

    if exists {
        return Err(AppError::Conflict("Email already registered".into()));
    }

    // Resolve referrer (by 8-digit referral code)
    let referrer_id: Option<Uuid> = if let Some(ref code) = req.referrer_code {
        sqlx::query_scalar("SELECT id FROM users WHERE referral_code = $1")
            .bind(code)
            .fetch_optional(&state.db)
            .await?
    } else {
        None
    };

    // Hash password
    let password_hash = hash_password(&req.password)?;
    let is_udg = req.is_udg_member.unwrap_or(false);

    // FR-08: Insert user (auto-generate username from email prefix, handle UNIQUE collision)
    use rand::Rng;
    let user_id = Uuid::new_v4();
    let base_username = req.email.split('@').next().unwrap_or("user").to_string();
    let mut auto_username = base_username.clone();
    for attempt in 0..5 {
        let name_exists =
            sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
                .bind(&auto_username)
                .fetch_one(&state.db)
                .await?;
        if !name_exists {
            break;
        }
        auto_username = format!(
            "{}_{}",
            base_username,
            rand::thread_rng().gen_range(1000..9999u32)
        );
        if attempt == 4 {
            auto_username = format!("{}_{}", base_username, &Uuid::new_v4().to_string()[..8]);
        }
    }
    // Generate 8-digit numeric referral code with retry on uniqueness conflict
    let mut referral_code = format!("{:08}", rand::thread_rng().gen_range(0..100_000_000u32));
    let mut insert_succeeded = false;
    for _attempt in 0..5 {
        // M-9: Catch unique constraint violation to handle TOCTOU race on duplicate email
        match sqlx::query(
            r#"INSERT INTO users (id, username, email, phone, password_hash, real_name, nickname, role, is_udg_member, referrer_id, status, is_email_verified, referral_code)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'buyer', $8, $9, 'active', TRUE, $10)"#,
        )
        .bind(user_id)
        .bind(&auto_username)
        .bind(&req.email)
        .bind(&req.phone)
        .bind(&password_hash)
        .bind(req.real_name.as_deref().unwrap_or(""))
        .bind(&req.nickname)
        .bind(is_udg)
        .bind(referrer_id)
        .bind(&referral_code)
        .execute(&state.db)
        .await
        {
            Ok(_) => {
                insert_succeeded = true;
                break;
            }
            Err(e) => {
                if let sqlx::Error::Database(ref db_err) = e {
                    // PostgreSQL unique_violation error code is "23505"
                    if db_err.code().as_deref() == Some("23505") {
                        // Check if it's the referral_code constraint - retry with new code
                        let msg = db_err.message().to_lowercase();
                        if msg.contains("referral_code") {
                            referral_code = format!("{:08}", rand::thread_rng().gen_range(0..100_000_000u32));
                            continue;
                        }
                        // Otherwise it's email uniqueness
                        return Err(AppError::Conflict("Email already registered".into()));
                    }
                }
                return Err(e.into());
            }
        }
    }
    if !insert_succeeded {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Failed to generate unique referral code"
        )));
    }

    // Delete the email verification token from Redis after successful signup
    {
        if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
            let verified_key = format!("email_verified:{}", &req.email);
            let _: Option<()> = redis::cmd("DEL")
                .arg(&verified_key)
                .query_async(&mut conn)
                .await
                .ok();
        }
    }

    let user_profile = UserProfile {
        id: user_id,
        email: req.email.clone(),
        nickname: req.nickname.clone(),
        role: crate::domain::user::UserRole::Buyer,
        phone: req.phone.clone(),
        is_email_verified: true,
        is_phone_verified: false,
        is_udg_member: is_udg,
        is_2fa_enabled: false,
        locale: Some("ko".into()),
        theme: Some("light".into()),
        status: Some("active".into()),
        referral_code: referral_code.clone(),
    };

    // FR-15: 신규 회원 환영 쿠폰 자동 발급
    if let Err(e) = issue_welcome_coupon(&state.db, user_id).await {
        tracing::warn!("Failed to issue welcome coupon for user {}: {}", user_id, e);
    }

    // UDG 연동: is_udg_member 체크 시에만 UDGworld로 전송
    if is_udg {
        if let Err(e) = crate::domain::udg::enqueue_udg_user_registered(
            &state.db,
            user_id,
            &user_profile.email,
            &auto_username,
            req.nickname.as_deref(),
            req.real_name.as_deref().unwrap_or(""),
            req.phone.as_deref(),
            &referral_code,
            &password_hash,
            referrer_id,
        )
        .await
        {
            tracing::warn!(
                "Failed to enqueue UDG user.registered event for user {}: {}",
                user_id,
                e
            );
        } else {
            // 큐에 성공적으로 등록된 경우 즉시 전송 시도 (비동기, 실패 시 스케줄러가 재시도)
            let state_bg = state.clone();
            tokio::spawn(async move {
                if let Err(e) = crate::scheduler::webhook::process_webhook_queue(&state_bg).await {
                    tracing::warn!(
                        "Immediate webhook dispatch failed, scheduler will retry: {}",
                        e
                    );
                }
            });
        }
    }

    let expires_in = state.config.jwt_expiry_hours * 3600;
    let tokens = generate_tokens(user_id, "buyer", is_udg, &state)?;
    save_refresh_token(&state, user_id, &tokens.1, None).await?;

    Ok(Json(AuthResponse {
        data: AuthData {
            access_token: tokens.0,
            refresh_token: tokens.1,
            expires_in,
            user: user_profile,
        },
    }))
}

/// FR-15: 신규 회원 환영 쿠폰 자동 발급
/// Uses a database transaction with INSERT ... ON CONFLICT to prevent duplicate
/// coupon creation under concurrent signup requests.
async fn issue_welcome_coupon(db: &sqlx::PgPool, user_id: Uuid) -> anyhow::Result<()> {
    let mut tx = db.begin().await?;

    // Lock the coupon row with FOR UPDATE to prevent race conditions on max_uses check
    let welcome_coupon = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT id FROM coupons
           WHERE code = 'WELCOME' AND is_active = TRUE
           AND (max_uses IS NULL OR current_uses < max_uses)
           AND expires_at > NOW()
           FOR UPDATE"#,
    )
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(coupon_id) = welcome_coupon {
        // Use INSERT ... ON CONFLICT to atomically prevent duplicates
        let result = sqlx::query(
            r#"INSERT INTO user_coupons (id, user_id, coupon_id, status)
               VALUES ($1, $2, $3, 'available')
               ON CONFLICT (user_id, coupon_id) DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(coupon_id)
        .execute(&mut *tx)
        .await?;

        // Only increment current_uses if the insert actually happened
        if result.rows_affected() > 0 {
            sqlx::query("UPDATE coupons SET current_uses = current_uses + 1 WHERE id = $1")
                .bind(coupon_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    tx.commit().await?;
    Ok(())
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // FR-10: brute-force 방어 (5회 실패 시 30분 잠금) - FR-18: Redis 장애 시 fail-closed
    check_brute_force(
        &state.redis,
        "login_fail",
        &req.email,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_LOCKOUT_SECS,
    )
    .await?;

    let user = sqlx::query_as::<_, crate::domain::User>(
        "SELECT * FROM users WHERE email = $1 AND status = 'active'",
    )
    .bind(&req.email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

    // Verify password
    if !verify_password(&req.password, &user.password_hash)? {
        // FR-10: 실패 카운트 증가
        increment_fail(&state.redis, "login_fail", &req.email, LOGIN_LOCKOUT_SECS).await;
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    }

    // Check 2FA — do NOT reset fail counter yet (F6-1: prevents password-valid info leak)
    if user.is_2fa_enabled {
        return Err(AppError::TwoFaRequired);
    }

    // FR-10: 로그인 성공 시 카운터 리셋 (only after full auth completes)
    reset_fail(&state.redis, "login_fail", &req.email).await;

    // Update last login
    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    let expires_in = state.config.jwt_expiry_hours * 3600;
    let tokens = generate_tokens(user.id, &user.role.to_string(), user.is_udg_member, &state)?;
    save_refresh_token(&state, user.id, &tokens.1, None).await?;

    Ok(Json(AuthResponse {
        data: AuthData {
            access_token: tokens.0,
            refresh_token: tokens.1,
            expires_in,
            user: user.into(),
        },
    }))
}

#[derive(serde::Deserialize)]
struct RefreshRequest {
    refresh_token: String,
}

async fn refresh_token(
    State(state): State<AppState>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // FR-06: Use issuer/audience validation for refresh tokens
    let mut refresh_validation = jsonwebtoken::Validation::default();
    refresh_validation.set_issuer(&[crate::middleware::auth::JWT_ISSUER]);
    refresh_validation.set_audience(&[crate::middleware::auth::JWT_AUDIENCE]);

    let token_data = jsonwebtoken::decode::<Claims>(
        &req.refresh_token,
        &jsonwebtoken::DecodingKey::from_secret(state.config.jwt_refresh_secret.as_bytes()),
        &refresh_validation,
    )
    .map_err(|_| AppError::Unauthorized("Invalid refresh token".into()))?;

    // Hash the token for DB lookup
    let token_hash = hash_token(&req.refresh_token);

    // Round 7 (Audit Security L-9): Family rotation 으로 도난 감지.
    // 1) row 잠그고 used_at 검사
    // 2) 이미 사용됨 (used_at NOT NULL) → family 전체 무효화 + 보안 알림
    // 3) 미사용 → 사용 마킹 + 같은 family 로 새 토큰 발급
    let mut tx = state.db.begin().await?;

    let row = sqlx::query_as::<_, (Uuid, Uuid, Option<chrono::DateTime<Utc>>)>(
        r#"SELECT id, family_id, used_at FROM refresh_tokens
           WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()
           FOR UPDATE"#,
    )
    .bind(token_data.claims.sub)
    .bind(&token_hash)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((row_id, family_id, used_at)) = row else {
        tx.commit().await.ok();
        return Err(AppError::Unauthorized(
            "Refresh token revoked or expired".into(),
        ));
    };

    if used_at.is_some() {
        // 도난 감지: 이미 사용된 토큰이 다시 들어옴.
        // 같은 family 의 모든 토큰을 폐기하고 사용자 알림.
        sqlx::query("DELETE FROM refresh_tokens WHERE family_id = $1")
            .bind(family_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;

        // 보안 알림 (best-effort, 실패해도 차단 응답은 그대로).
        let _ = crate::domain::notification::create_notification(
            &state.db,
            Some(&state.ws_hub),
            token_data.claims.sub,
            "system",
            "보안 경고: 의심 활동 감지",
            "리프레시 토큰의 비정상 재사용이 감지되어 모든 세션을 종료했습니다. 계정 보안을 점검하고 비밀번호 변경을 권장합니다.",
            Some("/profile"),
        )
        .await;

        return Err(AppError::Unauthorized(
            "Token reuse detected. All sessions revoked.".into(),
        ));
    }

    // 정상 경로: 토큰을 사용 처리.
    sqlx::query("UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1")
        .bind(row_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    let user = sqlx::query_as::<_, crate::domain::User>(
        "SELECT * FROM users WHERE id = $1 AND status = 'active'",
    )
    .bind(token_data.claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Unauthorized("User not found".into()))?;

    let expires_in = state.config.jwt_expiry_hours * 3600;
    let tokens = generate_tokens(user.id, &user.role.to_string(), user.is_udg_member, &state)?;
    save_refresh_token(&state, user.id, &tokens.1, Some(family_id)).await?;

    Ok(Json(AuthResponse {
        data: AuthData {
            access_token: tokens.0,
            refresh_token: tokens.1,
            expires_in,
            user: user.into(),
        },
    }))
}

#[derive(serde::Deserialize)]
struct ForgotPasswordRequest {
    email: String,
}

async fn forgot_password(
    State(state): State<AppState>,
    Json(req): Json<ForgotPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Always return success to prevent email enumeration
    let success = serde_json::json!({
        "data": { "message": "If that email is registered, a reset link has been sent." }
    });

    // Look up user
    let user: Option<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, email, COALESCE(nickname, username) as name FROM users WHERE email = $1 AND status = 'active'",
    )
    .bind(&req.email)
    .fetch_optional(&state.db)
    .await?;

    let Some((user_id, _email, user_name)) = user else {
        // Sleep to prevent timing attacks
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        return Ok(Json(success));
    };

    // Invalidate existing unused tokens
    sqlx::query(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    // Generate random 32-byte token
    use rand::Rng;
    let token_bytes: [u8; 32] = rand::thread_rng().gen();
    let token_hex = hex::encode(token_bytes);

    // Hash for storage
    let mut hasher = Sha256::new();
    hasher.update(token_hex.as_bytes());
    let token_hash = hex::encode(hasher.finalize());

    let expires_at = Utc::now() + chrono::Duration::hours(1);

    sqlx::query(
        "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    // Build reset URL
    let base_url = std::env::var("PASSWORD_RESET_BASE_URL").unwrap_or_else(|_| {
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".into())
            + "/reset-password"
    });
    let reset_url = format!("{}?token={}", base_url, token_hex);

    // Queue email (fire-and-forget)
    let _ = queue_email(
        &state.db,
        user_id,
        EmailTemplate::PasswordReset {
            reset_url,
            user_name,
        },
    )
    .await;

    Ok(Json(success))
}

#[derive(serde::Deserialize)]
struct ResetPasswordRequest {
    token: String,
    new_password: String,
}

async fn reset_password(
    State(state): State<AppState>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate password complexity
    validate_password_complexity(&req.new_password)?;

    // Validate token format (should be 64 hex chars = 32 bytes)
    if req.token.len() != 64 || !req.token.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::Unauthorized("Invalid reset token".into()));
    }

    // Hash the provided token
    let mut hasher = Sha256::new();
    hasher.update(req.token.as_bytes());
    let token_hash = hex::encode(hasher.finalize());

    // Find valid token
    let record: Option<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    let Some((token_id, user_id)) = record else {
        return Err(AppError::Unauthorized(
            "Invalid or expired reset token".into(),
        ));
    };

    // Hash new password
    let password_hash = hash_password(&req.new_password)?;

    // Update password + mark token as used + invalidate all refresh tokens (in transaction)
    let mut tx = state.db.begin().await?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&password_hash)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1")
        .bind(token_id)
        .execute(&mut *tx)
        .await?;

    // Invalidate all refresh tokens for security
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "data": { "message": "Password has been reset successfully." }
    })))
}

fn generate_tokens(
    user_id: Uuid,
    role: &str,
    is_udg_member: bool,
    state: &AppState,
) -> Result<(String, String), AppError> {
    let now = Utc::now().timestamp();

    let access_claims = Claims {
        sub: user_id,
        role: role.into(),
        is_udg_member,
        iss: JWT_ISSUER.into(),
        aud: JWT_AUDIENCE.into(),
        iat: now,
        exp: now + (state.config.jwt_expiry_hours * 3600),
    };

    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Token generation failed: {}", e)))?;

    let refresh_claims = Claims {
        sub: user_id,
        role: role.into(),
        is_udg_member,
        iss: JWT_ISSUER.into(),
        aud: JWT_AUDIENCE.into(),
        iat: now,
        exp: now + (state.config.jwt_refresh_expiry_days * 86400),
    };

    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(state.config.jwt_refresh_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Token generation failed: {}", e)))?;

    Ok((access_token, refresh_token))
}

/// SHA-256 hash for refresh token storage
fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Round 7 (Audit Security L-9): Refresh token family rotation 도입.
///
/// `family_id`:
///   - None → 새 로그인 세션 (신규 family 생성).
///   - Some(id) → 기존 refresh chain 계승 (rotation).
///
/// 도난 감지는 refresh_token 핸들러에서 처리 (used_at NOT NULL 인 row 재요청 시).
async fn save_refresh_token(
    state: &AppState,
    user_id: Uuid,
    token: &str,
    family_id: Option<Uuid>,
) -> Result<(), AppError> {
    let expires_at = Utc::now() + chrono::Duration::days(state.config.jwt_refresh_expiry_days);
    let token_hash = hash_token(token);
    let family = family_id.unwrap_or_else(Uuid::new_v4);

    sqlx::query(
        r#"INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&token_hash)
    .bind(family)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    // FR-22: 사용자당 최대 N개 family 유지 (오래된 것부터 family 전체 삭제).
    // 이전엔 token 단위 OFFSET 이라 같은 family 의 used 토큰이 남아 도난 감지를 방해할 수 있었음.
    let active_families = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT family_id FROM refresh_tokens
           WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
           GROUP BY family_id
           ORDER BY MAX(expires_at) DESC
           OFFSET $2"#,
    )
    .bind(user_id)
    .bind(MAX_REFRESH_TOKENS_PER_USER)
    .fetch_all(&state.db)
    .await?;

    if !active_families.is_empty() {
        sqlx::query("DELETE FROM refresh_tokens WHERE family_id = ANY($1)")
            .bind(&active_families)
            .execute(&state.db)
            .await?;
    }

    Ok(())
}

/// Public wrapper for OAuth module to generate tokens
pub fn generate_tokens_public(
    user_id: Uuid,
    role: &str,
    is_udg_member: bool,
    state: &AppState,
) -> Result<(String, String), AppError> {
    generate_tokens(user_id, role, is_udg_member, state)
}

/// Public wrapper for OAuth module to save refresh tokens.
/// OAuth 로그인은 신규 family (기존 chain 계승 안 함).
pub async fn save_refresh_token_public(
    state: &AppState,
    user_id: Uuid,
    token: &str,
) -> Result<(), AppError> {
    save_refresh_token(state, user_id, token, None).await
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2, Params,
    };

    let salt = SaltString::generate(&mut OsRng);
    let params = Params::new(65536, 3, 1, None)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Argon2 params error: {}", e)))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))?
        .to_string();

    Ok(hash)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };

    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hash parse failed: {}", e)))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Validate password complexity: min 8 chars, at least 3 of 4 categories
pub fn validate_password_complexity(password: &str) -> Result<(), AppError> {
    if password.len() > 128 {
        return Err(AppError::Validation {
            message: "Password must not exceed 128 characters".into(),
            field: Some("password".into()),
        });
    }
    if password.len() < 8 {
        return Err(AppError::Validation {
            message: "Password must be at least 8 characters".into(),
            field: Some("password".into()),
        });
    }

    let has_upper = password.chars().any(|c| c.is_ascii_uppercase());
    let has_lower = password.chars().any(|c| c.is_ascii_lowercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_special = password.chars().any(|c| !c.is_alphanumeric());

    let categories = [has_upper, has_lower, has_digit, has_special]
        .iter()
        .filter(|&&v| v)
        .count();

    if categories < 3 {
        return Err(AppError::Validation {
            message: "Password must contain at least 3 of: uppercase, lowercase, digit, special character".into(),
            field: Some("password".into()),
        });
    }

    Ok(())
}

// --- 2FA Login (CRIT-04) ---

#[derive(serde::Deserialize)]
struct Login2faRequest {
    email: String,
    password: String,
    totp_code: String,
}

/// Complete login for users with 2FA enabled
async fn login_2fa(
    State(state): State<AppState>,
    Json(req): Json<Login2faRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // FR-03: brute-force 방어 — F6-2 FIX: share namespace with login to prevent double budget
    check_brute_force(
        &state.redis,
        "login_fail",
        &req.email,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_LOCKOUT_SECS,
    )
    .await?;

    let user = sqlx::query_as::<_, crate::domain::User>(
        "SELECT * FROM users WHERE email = $1 AND status = 'active'",
    )
    .bind(&req.email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

    // Verify password
    if !verify_password(&req.password, &user.password_hash)? {
        // FR-03: 실패 카운트 증가 — F6-2 FIX: shared namespace
        increment_fail(&state.redis, "login_fail", &req.email, LOGIN_LOCKOUT_SECS).await;
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    }

    // Require 2FA to be enabled.
    //
    // 보안: 2FA 미활성 계정도 "Invalid email or password" 로 통일 응답.
    // 이전엔 "2FA is not enabled for this account" 라는 명시적 메시지 반환했는데,
    // /auth/login 응답과 비교하면 2FA 활성화 여부를 추론 가능했다 (enumeration).
    // 같은 unauthorized 메시지로 통일해서 식별 차단.
    if !user.is_2fa_enabled {
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    }

    // Verify TOTP code
    crate::middleware::totp::verify_totp(
        &state.db,
        user.id,
        &req.totp_code,
        &state.config.totp_encryption_key,
    )
    .await?;

    // FR-03: 로그인 성공 시 카운터 리셋 — F6-2 FIX: shared namespace
    reset_fail(&state.redis, "login_fail", &req.email).await;

    // Update last login
    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    let expires_in = state.config.jwt_expiry_hours * 3600;
    let tokens = generate_tokens(user.id, &user.role.to_string(), user.is_udg_member, &state)?;
    save_refresh_token(&state, user.id, &tokens.1, None).await?;

    Ok(Json(AuthResponse {
        data: AuthData {
            access_token: tokens.0,
            refresh_token: tokens.1,
            expires_in,
            user: user.into(),
        },
    }))
}
