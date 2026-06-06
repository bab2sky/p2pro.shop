use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Validation error: {message}")]
    Validation {
        message: String,
        field: Option<String>,
    },

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("2FA required")]
    TwoFaRequired,

    #[error("Rate limited")]
    RateLimited { retry_after: u64 },

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

impl AppError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            Self::Validation { .. } => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::Forbidden(_) | Self::TwoFaRequired => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::RateLimited { .. } => StatusCode::TOO_MANY_REQUESTS,
            Self::Internal(_) | Self::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn error_code(&self) -> &str {
        match self {
            Self::Validation { .. } => "VALIDATION_ERROR",
            Self::Unauthorized(_) => "UNAUTHORIZED",
            Self::Forbidden(_) => "FORBIDDEN",
            Self::NotFound(_) => "NOT_FOUND",
            Self::Conflict(_) => "CONFLICT",
            Self::TwoFaRequired => "TWO_FA_REQUIRED",
            Self::RateLimited { .. } => "RATE_LIMITED",
            Self::Internal(_) | Self::Database(_) => "INTERNAL_ERROR",
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();

        let body = match &self {
            Self::Validation { field, .. } => json!({
                "error": {
                    "code": self.error_code(),
                    "message": self.to_string(),
                    "details": { "field": field },
                }
            }),
            Self::RateLimited { retry_after } => json!({
                "error": {
                    "code": self.error_code(),
                    "message": self.to_string(),
                    "details": { "retry_after": retry_after },
                }
            }),
            _ => {
                // S-H6: Hide internal error details from clients
                let client_message = match &self {
                    Self::Internal(_) | Self::Database(_) => {
                        "An internal error occurred".to_string()
                    }
                    other => other.to_string(),
                };
                json!({
                    "error": {
                        "code": self.error_code(),
                        "message": client_message,
                    }
                })
            }
        };

        if matches!(self, Self::Internal(_) | Self::Database(_)) {
            tracing::error!("Internal error: {:?}", self);
            sentry::capture_message(&format!("{:?}", self), sentry::Level::Error);
        }

        (status, Json(body)).into_response()
    }
}
