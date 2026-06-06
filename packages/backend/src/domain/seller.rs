use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// DDL seller_profiles fully mapped
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SellerProfile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub seller_type: String,
    pub wallet_address: String,
    pub contact_phone: Option<String>,
    pub main_category_id: Option<Uuid>,
    pub deposit_amount: Option<BigDecimal>,
    pub deposit_txid: Option<String>,
    pub balance: Option<BigDecimal>,
    pub total_sales: Option<i32>,
    pub total_revenue: Option<BigDecimal>,
    pub avg_rating: Option<BigDecimal>,
    pub response_rate: Option<BigDecimal>,
    pub avg_ship_days: Option<BigDecimal>,
    pub grade: Option<i16>,
    pub grade_score: Option<BigDecimal>,
    pub dispute_count: Option<i32>,
    pub status: Option<String>,
    pub rejected_reason: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub business_name: Option<String>,
    pub business_number: Option<String>,
    pub representative_name: Option<String>,
    pub business_address: Option<String>,
    pub business_type: Option<String>,
    pub business_category: Option<String>,
    /// v1.3.10: 한 번 등록한 지갑은 변경 불가 정책. true 로 set 되면 frontend
    /// 가 입력 폼을 read-only 로 잠근다. 새 row 는 default false.
    pub wallet_locked: bool,
}

#[derive(Debug, Deserialize)]
pub struct SellerApplyRequest {
    pub seller_type: String,
    pub wallet_address: String,
    pub contact_phone: Option<String>,
    pub main_category_id: Option<Uuid>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SellerPublicProfile {
    pub id: Uuid,
    pub user_nickname: Option<String>,
    pub seller_type: String,
    pub profile_image: Option<String>,
    pub total_sales: Option<i32>,
    pub avg_rating: Option<BigDecimal>,
    pub response_rate: Option<BigDecimal>,
    pub avg_ship_days: Option<BigDecimal>,
    pub grade: Option<String>,
    pub product_count: Option<i64>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RecentReview {
    pub id: Uuid,
    pub rating: i16,
    pub content: Option<String>,
    pub created_at: DateTime<Utc>,
}
