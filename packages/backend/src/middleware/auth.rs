use axum::{
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::user::UserRole;
use crate::{AppError, AppState};

pub const JWT_ISSUER: &str = "p2pro.store";
pub const JWT_AUDIENCE: &str = "p2pro-api";

// TODO(SSO): HS256 → RS256 전환 검토
// - 현재: HS256 (단일 백엔드, secret 기반)
// - 전환 조건: udgworld.com SSO 연동 시 또는 서비스 3대 이상일 때
// - 전환 시: DecodingKey::from_rsa_pem() + JWKS endpoint 제공
// - Claims 구조는 동일하게 유지 가능
fn jwt_validation() -> Validation {
    let mut v = Validation::default();
    v.set_issuer(&[JWT_ISSUER]);
    v.set_audience(&[JWT_AUDIENCE]);
    v
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub role: String,
    pub is_udg_member: bool,
    pub iss: String,
    pub aud: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub role: UserRole,
    pub is_udg_member: bool,
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".into()))?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &jwt_validation(),
    )
    .map_err(|e| {
        tracing::debug!("JWT validation failed: {}", e);
        AppError::Unauthorized("Invalid or expired token".into())
    })?;

    let auth_user = AuthUser {
        id: token_data.claims.sub,
        role: UserRole::from_str_lossy(&token_data.claims.role),
        is_udg_member: token_data.claims.is_udg_member,
    };

    req.extensions_mut().insert(auth_user);
    Ok(next.run(req).await)
}

/// Optional auth: doesn't fail if no token, just doesn't add AuthUser to extensions.
/// Used for endpoints that are public but have auth-specific behavior (e.g., wishlist check).
pub async fn optional_auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    if let Some(token) = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
    {
        if let Ok(token_data) = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &jwt_validation(),
        ) {
            let auth_user = AuthUser {
                id: token_data.claims.sub,
                role: UserRole::from_str_lossy(&token_data.claims.role),
                is_udg_member: token_data.claims.is_udg_member,
            };
            req.extensions_mut().insert(auth_user);
        }
    }
    Ok(next.run(req).await)
}
