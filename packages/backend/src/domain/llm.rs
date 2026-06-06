//! LLM integration for customer support chatbot (Ollama / Google Gemini)

use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::time::Duration;

use crate::AppError;

// --- Request / Response types ---

#[derive(Debug, Deserialize)]
pub struct ChatSupportRequest {
    pub message: String,
    #[serde(default)]
    pub history: Vec<ChatHistoryEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatHistoryEntry {
    pub role: String, // "user" | "assistant"
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatSupportResponse {
    pub reply: String,
}

// --- Default system prompt ---

const DEFAULT_SYSTEM_PROMPT: &str = r#"당신은 P2PRO 오픈마켓의 AI 고객센터 상담원입니다.

P2PRO는 USDT 에스크로 기반 P2P 마켓플레이스입니다. 주요 규칙:
- 결제는 USDT로만 가능하며, 에스크로 방식으로 안전하게 처리됩니다.
- 판매자 마진: 5~40% (판매자 설정)
- 출금 수수료: 5%, 최소 출금 금액: 10 USDT
- 구매 확정: 배송 완료 후 7일 자동 확정
- TXID 입력 제한: 24시간 이내
- 출금 시 2FA(2단계 인증) 필수
- UDG 분배 후에는 환불 불가

대화 규칙:
- 한국어로 친절하고 간결하게 답변하세요.
- 정확하지 않은 정보는 "확인 후 안내드리겠습니다"라고 답변하세요.
- 개인정보(비밀번호, 지갑 주소 등)를 절대 요청하지 마세요.
- 기술적 문제는 고객센터 이메일이나 1:1 문의를 안내하세요."#;

// --- Settings loader ---

struct LlmSettings {
    provider: String,
    model: String,
    api_key: Option<String>,
    ollama_url: Option<String>,
    system_prompt: String,
}

async fn load_llm_settings(db: &PgPool) -> Result<LlmSettings, AppError> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT key, value FROM system_settings WHERE key LIKE 'chatbot_%'",
    )
    .fetch_all(db)
    .await?;

    let get = |k: &str| -> Option<String> {
        rows.iter()
            .find(|(key, _)| key == k)
            .map(|(_, v)| v.clone())
            .filter(|v| !v.is_empty())
    };

    let provider = get("chatbot_provider").unwrap_or_else(|| "ollama".to_string());
    let model = get("chatbot_model").unwrap_or_else(|| match provider.as_str() {
        "gemini" => "gemini-2.0-flash".to_string(),
        _ => "llama3".to_string(),
    });
    let api_key = get("chatbot_api_key");
    let ollama_url = get("chatbot_ollama_url");
    let system_prompt =
        get("chatbot_system_prompt").unwrap_or_else(|| DEFAULT_SYSTEM_PROMPT.to_string());

    Ok(LlmSettings {
        provider,
        model,
        api_key,
        ollama_url,
        system_prompt,
    })
}

// --- Main LLM call dispatcher ---

pub async fn call_llm(
    db: &PgPool,
    message: &str,
    history: &[ChatHistoryEntry],
) -> Result<String, AppError> {
    let settings = load_llm_settings(db).await?;
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("HTTP client error: {e}")))?;

    match settings.provider.as_str() {
        "gemini" => call_gemini(&client, &settings, message, history).await,
        _ => call_ollama(&client, &settings, message, history).await,
    }
}

// --- Ollama ---

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
}

#[derive(Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: Option<OllamaMessage>,
}

async fn call_ollama(
    client: &Client,
    settings: &LlmSettings,
    message: &str,
    history: &[ChatHistoryEntry],
) -> Result<String, AppError> {
    let base_url = settings
        .ollama_url
        .as_deref()
        .unwrap_or("http://localhost:11434");
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));

    let mut messages = vec![OllamaMessage {
        role: "system".to_string(),
        content: settings.system_prompt.clone(),
    }];

    for entry in history {
        messages.push(OllamaMessage {
            role: entry.role.clone(),
            content: entry.content.clone(),
        });
    }

    messages.push(OllamaMessage {
        role: "user".to_string(),
        content: message.to_string(),
    });

    let body = OllamaRequest {
        model: settings.model.clone(),
        messages,
        stream: false,
    };

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Ollama request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Ollama error {status}: {text}"
        )));
    }

    let data: OllamaResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Ollama parse error: {e}")))?;

    data.message
        .map(|m| m.content)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Ollama returned empty response")))
}

// --- Google Gemini ---

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "systemInstruction")]
    system_instruction: GeminiContent,
}

#[derive(Serialize, Deserialize)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

async fn call_gemini(
    client: &Client,
    settings: &LlmSettings,
    message: &str,
    history: &[ChatHistoryEntry],
) -> Result<String, AppError> {
    let api_key = settings
        .api_key
        .as_deref()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Gemini API key not configured")))?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        settings.model, api_key
    );

    let mut contents: Vec<GeminiContent> = Vec::new();

    for entry in history {
        let role = match entry.role.as_str() {
            "assistant" => "model",
            _ => "user",
        };
        contents.push(GeminiContent {
            role: Some(role.to_string()),
            parts: vec![GeminiPart {
                text: entry.content.clone(),
            }],
        });
    }

    contents.push(GeminiContent {
        role: Some("user".to_string()),
        parts: vec![GeminiPart {
            text: message.to_string(),
        }],
    });

    let body = GeminiRequest {
        contents,
        system_instruction: GeminiContent {
            role: None,
            parts: vec![GeminiPart {
                text: settings.system_prompt.clone(),
            }],
        },
    };

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Gemini request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Gemini error {status}: {text}"
        )));
    }

    let data: GeminiResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Gemini parse error: {e}")))?;

    data.candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|c| c.parts.into_iter().next())
        .map(|p| p.text)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Gemini returned empty response")))
}

/// Test LLM connection with a simple prompt
pub async fn test_llm_connection(db: &PgPool) -> Result<String, AppError> {
    call_llm(
        db,
        "안녕하세요, 연결 테스트입니다. 한 문장으로 짧게 답변해주세요.",
        &[],
    )
    .await
}
