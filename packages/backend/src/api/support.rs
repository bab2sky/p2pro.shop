//! Public chat support endpoint (LLM-powered)

use axum::{extract::State, Json};
use serde_json::json;

use crate::domain::llm::{ChatSupportRequest, ChatSupportResponse};
use crate::{AppError, AppState};

/// POST /api/chat/support — public LLM chatbot endpoint
pub async fn chat_support(
    State(state): State<AppState>,
    Json(req): Json<ChatSupportRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate message length
    let msg_len = req.message.trim().len();
    if msg_len == 0 || msg_len > 2000 {
        return Err(AppError::Validation {
            message: "메시지는 1~2000자 이내로 입력해주세요.".into(),
            field: Some("message".into()),
        });
    }

    // Limit history to 20 entries
    let history: Vec<_> = req.history.into_iter().take(20).collect();

    // Call LLM with fallback
    match crate::domain::llm::call_llm(&state.db, &req.message, &history).await {
        Ok(reply) => Ok(Json(json!({
            "data": ChatSupportResponse { reply }
        }))),
        Err(e) => {
            tracing::warn!("LLM call failed, returning fallback: {e}");
            Ok(Json(json!({
                "data": ChatSupportResponse {
                    reply: "죄송합니다. 현재 AI 상담 서비스에 일시적인 문제가 발생했습니다.\n잠시 후 다시 시도하시거나, 고객센터로 직접 문의해 주세요.".to_string(),
                },
                "fallback": true
            })))
        }
    }
}
