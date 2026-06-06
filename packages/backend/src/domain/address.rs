use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Address {
    pub id: Uuid,
    pub user_id: Uuid,
    pub label: Option<String>,
    pub recipient_name: String,
    pub recipient_phone: String,
    pub zipcode: String,
    pub address1: String,
    pub address2: Option<String>,
    pub is_default: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAddressRequest {
    pub label: Option<String>,
    pub recipient_name: String,
    pub recipient_phone: String,
    pub zipcode: String,
    pub address1: String,
    pub address2: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAddressRequest {
    pub label: Option<String>,
    pub recipient_name: Option<String>,
    pub recipient_phone: Option<String>,
    pub zipcode: Option<String>,
    pub address1: Option<String>,
    pub address2: Option<String>,
    pub is_default: Option<bool>,
}
