use crate::domain::oauth::{self, OAuthProvider};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};
use axum::{
    extract::{Path, Query, State},
    response::Redirect,
    routing::{delete, get, post},
    Extension, Json, Router,
};
use serde_json::json;
use uuid::Uuid;

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/auth/oauth/{provider}", get(oauth_redirect))
        .route("/auth/oauth/{provider}/callback", get(oauth_callback))
        .route("/auth/oauth/exchange", post(exchange_oauth_code))
}

pub fn protected_router() -> Router<AppState> {
    Router::new()
        .route("/auth/oauth/link", post(link_account))
        .route("/auth/oauth/unlink/{provider}", delete(unlink_account))
}

#[derive(serde::Deserialize)]
struct OAuthRedirectQuery {
    redirect_to: Option<String>,
}

async fn oauth_redirect(
    State(state): State<AppState>,
    Path(provider_str): Path<String>,
    Query(query): Query<OAuthRedirectQuery>,
) -> Result<Redirect, AppError> {
    let provider = OAuthProvider::from_str(&provider_str).ok_or_else(|| AppError::Validation {
        message: "Unsupported OAuth provider".into(),
        field: Some("provider".into()),
    })?;

    // FR-21: redirect_to 상대경로만 허용 (open redirect 방지)
    let redirect_to = query.redirect_to.unwrap_or_else(|| "/".into());
    if !redirect_to.starts_with('/') || redirect_to.starts_with("//") {
        return Err(AppError::Validation {
            message: "Invalid redirect path".into(),
            field: Some("redirect_to".into()),
        });
    }

    let pkce = oauth::generate_pkce();

    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let redis_key = format!("oauth:{}:{}", provider.as_str(), pkce.state);
    let redis_value = serde_json::json!({
        "verifier": pkce.verifier,
        "redirect_to": redirect_to,
    });
    redis::AsyncCommands::set_ex::<_, _, ()>(&mut conn, &redis_key, redis_value.to_string(), 300)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis SET error: {}", e)))?;

    let (client_id, redirect_uri) = match provider {
        OAuthProvider::Google => (
            &state.config.google_client_id,
            &state.config.google_redirect_uri,
        ),
        OAuthProvider::Kakao => (
            &state.config.kakao_client_id,
            &state.config.kakao_redirect_uri,
        ),
    };

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
        provider.auth_url(),
        client_id,
        urlencoding::encode(redirect_uri),
        urlencoding::encode(provider.scopes()),
        pkce.state,
        pkce.challenge,
    );

    Ok(Redirect::temporary(&auth_url))
}

#[derive(serde::Deserialize)]
struct CallbackQuery {
    code: String,
    state: String,
}

async fn oauth_callback(
    State(state): State<AppState>,
    Path(provider_str): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Result<Redirect, AppError> {
    let provider = OAuthProvider::from_str(&provider_str).ok_or_else(|| AppError::Validation {
        message: "Unsupported provider".into(),
        field: Some("provider".into()),
    })?;

    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let redis_key = format!("oauth:{}:{}", provider.as_str(), query.state);
    let stored: Option<String> = redis::AsyncCommands::get(&mut conn, &redis_key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis GET error: {}", e)))?;

    let stored = stored.ok_or_else(|| AppError::Validation {
        message: "OAuth state expired or invalid".into(),
        field: Some("state".into()),
    })?;

    let _: () = redis::AsyncCommands::del(&mut conn, &redis_key)
        .await
        .unwrap_or(());

    let stored_data: serde_json::Value = serde_json::from_str(&stored)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid stored OAuth state")))?;

    let verifier = stored_data["verifier"].as_str().unwrap_or_default();
    let redirect_to = stored_data["redirect_to"].as_str().unwrap_or("/");

    let (client_id, client_secret, redirect_uri) = match provider {
        OAuthProvider::Google => (
            state.config.google_client_id.as_str(),
            state.config.google_client_secret.as_str(),
            state.config.google_redirect_uri.as_str(),
        ),
        OAuthProvider::Kakao => (
            state.config.kakao_client_id.as_str(),
            state.config.kakao_client_secret.as_str(),
            state.config.kakao_redirect_uri.as_str(),
        ),
    };

    let http_client = reqwest::Client::new();

    let token_resp = oauth::exchange_code(
        &http_client,
        provider,
        &query.code,
        verifier,
        client_id,
        client_secret,
        redirect_uri,
    )
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("OAuth token exchange failed: {}", e)))?;

    let user_info = oauth::fetch_userinfo(&http_client, provider, &token_resp.access_token)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OAuth userinfo failed: {}", e)))?;

    let (user_id, role, is_udg, is_new) = oauth::resolve_user(&state.db, &user_info)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("User resolution failed: {}", e)))?;

    // CRIT-03: Use one-time code exchange instead of exposing tokens in URL
    let tokens = crate::api::auth::generate_tokens_public(user_id, &role, is_udg, &state)?;
    crate::api::auth::save_refresh_token_public(&state, user_id, &tokens.1).await?;

    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    // Store tokens in Redis with a one-time code (expires in 60s)
    let auth_code = Uuid::new_v4().to_string();
    let code_data = serde_json::json!({
        "access_token": tokens.0,
        "refresh_token": tokens.1,
        "expires_in": state.config.jwt_expiry_hours * 3600,
        "is_new_user": is_new,
    });

    let mut redis_conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;
    redis::AsyncCommands::set_ex::<_, _, ()>(
        &mut redis_conn,
        &format!("oauth:code:{}", auth_code),
        code_data.to_string(),
        60, // 60 seconds expiry
    )
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis SET error: {}", e)))?;

    let callback_url = format!(
        "{}?code={}&redirect_to={}",
        state.config.oauth_frontend_callback_url,
        auth_code,
        urlencoding::encode(redirect_to),
    );

    Ok(Redirect::temporary(&callback_url))
}

/// CRIT-03: Exchange one-time OAuth code for tokens (prevents token exposure in URL)
#[derive(serde::Deserialize)]
struct ExchangeCodeRequest {
    code: String,
}

async fn exchange_oauth_code(
    State(state): State<AppState>,
    Json(req): Json<ExchangeCodeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let redis_key = format!("oauth:code:{}", req.code);
    let stored: Option<String> = redis::AsyncCommands::get(&mut conn, &redis_key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis GET error: {}", e)))?;

    let stored =
        stored.ok_or_else(|| AppError::Unauthorized("Invalid or expired OAuth code".into()))?;

    // Delete immediately (one-time use)
    let _: () = redis::AsyncCommands::del(&mut conn, &redis_key)
        .await
        .unwrap_or(());

    let token_data: serde_json::Value = serde_json::from_str(&stored)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid stored token data")))?;

    Ok(Json(json!({ "data": token_data })))
}

#[derive(serde::Deserialize)]
struct LinkRequest {
    provider: String,
    code: String,
    code_verifier: String,
}

async fn link_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<LinkRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let provider = OAuthProvider::from_str(&req.provider).ok_or_else(|| AppError::Validation {
        message: "Unsupported provider".into(),
        field: Some("provider".into()),
    })?;

    let (client_id, client_secret, redirect_uri) = match provider {
        OAuthProvider::Google => (
            state.config.google_client_id.as_str(),
            state.config.google_client_secret.as_str(),
            state.config.google_redirect_uri.as_str(),
        ),
        OAuthProvider::Kakao => (
            state.config.kakao_client_id.as_str(),
            state.config.kakao_client_secret.as_str(),
            state.config.kakao_redirect_uri.as_str(),
        ),
    };

    let http_client = reqwest::Client::new();

    let token_resp = oauth::exchange_code(
        &http_client,
        provider,
        &req.code,
        &req.code_verifier,
        client_id,
        client_secret,
        redirect_uri,
    )
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("OAuth token exchange failed: {}", e)))?;

    let user_info = oauth::fetch_userinfo(&http_client, provider, &token_resp.access_token)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OAuth userinfo failed: {}", e)))?;

    // Check if already linked to another user
    let existing = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT user_id FROM social_logins WHERE provider = $1 AND provider_user_id = $2",
    )
    .bind(&user_info.provider)
    .bind(&user_info.provider_user_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(existing_id) = existing {
        if existing_id != auth.id {
            return Err(AppError::Conflict(
                "This provider account is already linked to another user".into(),
            ));
        }
        return Err(AppError::Conflict("Already linked to your account".into()));
    }

    sqlx::query(
        r#"INSERT INTO social_logins (user_id, provider, provider_user_id, provider_email, provider_name, provider_avatar_url, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())"#,
    )
    .bind(auth.id)
    .bind(&user_info.provider)
    .bind(&user_info.provider_user_id)
    .bind(&user_info.email)
    .bind(&user_info.name)
    .bind(&user_info.avatar_url)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({
        "data": {
            "provider": user_info.provider,
            "provider_email": user_info.email,
            "linked_at": chrono::Utc::now(),
        }
    })))
}

async fn unlink_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(provider_str): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let _provider = OAuthProvider::from_str(&provider_str).ok_or_else(|| AppError::Validation {
        message: "Unsupported provider".into(),
        field: Some("provider".into()),
    })?;

    // Check that user has a password set (cannot unlink if it's the only auth method)
    let password_hash =
        sqlx::query_scalar::<_, String>("SELECT password_hash FROM users WHERE id = $1")
            .bind(auth.id)
            .fetch_one(&state.db)
            .await?;

    // Check social login count
    let social_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM social_logins WHERE user_id = $1")
            .bind(auth.id)
            .fetch_one(&state.db)
            .await?;

    // If no password and only one social login, cannot unlink
    if password_hash.is_empty() && social_count <= 1 {
        return Err(AppError::Validation {
            message: "Cannot unlink: no password set. Set a password first.".into(),
            field: None,
        });
    }

    let result = sqlx::query("DELETE FROM social_logins WHERE user_id = $1 AND provider = $2")
        .bind(auth.id)
        .bind(&provider_str)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Social login not found".into()));
    }

    Ok(Json(json!({
        "data": {
            "message": "Social login unlinked successfully",
            "provider": provider_str,
        }
    })))
}
