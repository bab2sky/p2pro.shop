use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct ExchangeRequest {
    pub id: Uuid,
    pub order_id: Uuid,
    pub order_item_id: Uuid,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub reason_code: String,
    pub reason_detail: Option<String>,
    pub desired_option: Option<serde_json::Value>,
    pub status: String,
    pub return_tracking_number: Option<String>,
    pub return_carrier: Option<String>,
    pub new_tracking_number: Option<String>,
    pub new_carrier: Option<String>,
    pub seller_response: Option<String>,
    pub responded_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExchangeRequest {
    pub order_id: Uuid,
    pub order_item_id: Uuid,
    pub reason_code: String,
    pub reason_detail: Option<String>,
    pub desired_option: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExchangeStatusRequest {
    pub status: String,
    pub seller_response: Option<String>,
    pub new_tracking_number: Option<String>,
    pub new_carrier: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExchangeTrackingRequest {
    pub return_tracking_number: String,
    pub return_carrier: String,
}

// Order Inquiry types
#[derive(Debug, Serialize, FromRow)]
pub struct OrderInquiry {
    pub id: Uuid,
    pub order_id: Uuid,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub inquiry_type: String,
    pub title: String,
    pub content: String,
    pub images: Option<serde_json::Value>,
    pub status: String,
    pub seller_reply: Option<String>,
    pub replied_at: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInquiryRequest {
    pub order_id: Uuid,
    pub inquiry_type: String,
    pub title: String,
    pub content: String,
    pub images: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ReplyInquiryRequest {
    pub seller_reply: String,
}
