use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::domain::user::UserRole;
use crate::{AppError, AppState};

use super::auth::AuthUser;

/// RBAC middleware: require admin role (verified against DB)
pub async fn require_admin(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Authentication required".into()))?;

    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden("Admin role required".into()));
    }

    // FR-11: Verify admin role against DB (defense against stale JWT)
    let db_role = sqlx::query_scalar::<_, UserRole>(
        "SELECT role FROM users WHERE id = $1 AND status = 'active'",
    )
    .bind(auth_user.id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Database error: {}", e)))?;

    match db_role {
        Some(UserRole::Admin) => Ok(next.run(req).await),
        _ => Err(AppError::Forbidden("Admin role required".into())),
    }
}

/// RBAC middleware: require specific role
pub async fn require_seller(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Authentication required".into()))?;

    if auth_user.role != UserRole::Seller {
        return Err(AppError::Forbidden("Seller role required".into()));
    }

    // Verify seller is approved
    let approved = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM seller_profiles WHERE user_id = $1 AND status = 'approved')",
    )
    .bind(auth_user.id)
    .fetch_one(&state.db)
    .await?;

    if !approved {
        return Err(AppError::Forbidden("Seller not approved".into()));
    }

    Ok(next.run(req).await)
}
