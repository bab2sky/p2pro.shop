use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct ChatRoom {
    pub id: Uuid,
    pub order_id: Uuid,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub last_message_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ChatRoomWithInfo {
    pub id: Uuid,
    pub order_id: Uuid,
    pub other_user_id: Uuid,
    pub other_user_nickname: Option<String>,
    pub last_message: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub unread_count: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ChatMessage {
    pub id: Uuid,
    pub room_id: Uuid,
    pub sender_id: Uuid,
    pub content: String,
    pub is_read: bool,
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_thumbnail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    pub order_id: Uuid,
}

/// FR-18: 이미지 메시지 전송 요청
#[derive(Debug, Deserialize)]
pub struct ImageMessageRequest {
    pub image_url: String,
    pub thumbnail_url: Option<String>,
}

/// FR-19: 메시지 검색 파라미터
#[derive(Debug, Deserialize)]
pub struct SearchParams {
    pub q: Option<String>,
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

// WebSocket message types
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsClientMessage {
    #[serde(rename = "message")]
    Message { content: String },
    #[serde(rename = "typing")]
    Typing,
    #[serde(rename = "read")]
    Read,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum WsServerMessage {
    #[serde(rename = "message")]
    Message {
        id: Uuid,
        sender_id: Uuid,
        content: String,
        created_at: DateTime<Utc>,
    },
    #[serde(rename = "typing")]
    Typing { sender_id: Uuid },
    #[serde(rename = "read")]
    ReadConfirm { reader_id: Uuid },
    #[serde(rename = "error")]
    Error { message: String },
}
