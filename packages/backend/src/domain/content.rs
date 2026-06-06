use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- Notice ---

#[derive(Debug, Serialize, FromRow)]
pub struct Notice {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub target: Option<String>,
    pub is_pinned: Option<bool>,
    pub is_active: Option<bool>,
    pub author_id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNoticeRequest {
    pub title: String,
    pub content: String,
    pub is_pinned: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNoticeRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub is_pinned: Option<bool>,
    pub is_active: Option<bool>,
}

// --- Banner ---

#[derive(Debug, Serialize, FromRow)]
pub struct Banner {
    pub id: Uuid,
    pub title: String,
    pub image_url: String,
    pub link_url: Option<String>,
    pub position: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBannerRequest {
    pub title: String,
    pub image_url: String,
    pub link_url: Option<String>,
    pub sort_order: Option<i32>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBannerRequest {
    pub title: Option<String>,
    pub image_url: Option<String>,
    pub link_url: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
}

// --- FAQ ---

#[derive(Debug, Serialize, FromRow)]
pub struct Faq {
    pub id: Uuid,
    pub category: String,
    pub question: String,
    pub answer: String,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFaqRequest {
    pub category: Option<String>,
    pub question: String,
    pub answer: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFaqRequest {
    pub category: Option<String>,
    pub question: Option<String>,
    pub answer: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

// --- Query params ---

#[derive(Debug, Deserialize)]
pub struct FaqQueryParams {
    pub category: Option<String>,
}
