use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct Review {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub buyer_id: Uuid,
    pub rating: i16,
    pub content: Option<String>,
    pub images: Option<Vec<String>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReviewWithUser {
    pub id: Uuid,
    pub rating: i16,
    pub content: Option<String>,
    pub images: Option<Vec<String>>,
    pub created_at: Option<DateTime<Utc>>,
    pub user_nickname: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReviewWithUserExtended {
    pub id: Uuid,
    pub rating: i16,
    pub content: Option<String>,
    pub images: Option<Vec<String>>,
    pub helpful_count: Option<i32>,
    pub unhelpful_count: Option<i32>,
    pub seller_reply: Option<String>,
    pub seller_replied_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub user_nickname: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReviewStats {
    pub avg_rating: f64,
    pub total_count: i64,
    pub distribution: ReviewDistribution,
}

#[derive(Debug, Serialize)]
pub struct ReviewDistribution {
    #[serde(rename = "5")]
    pub five: i64,
    #[serde(rename = "4")]
    pub four: i64,
    #[serde(rename = "3")]
    pub three: i64,
    #[serde(rename = "2")]
    pub two: i64,
    #[serde(rename = "1")]
    pub one: i64,
}
