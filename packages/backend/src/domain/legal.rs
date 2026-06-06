use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- Category Attributes (카테고리별 필수 속성) ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CategoryAttribute {
    pub id: Uuid,
    pub category_id: Uuid,
    pub attribute_name: String,
    pub attribute_name_en: Option<String>,
    pub attribute_type: String,
    pub is_required: Option<bool>,
    pub options: Option<serde_json::Value>,
    pub placeholder: Option<String>,
    pub sort_order: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductAttribute {
    pub id: Uuid,
    pub product_id: Uuid,
    pub attribute_id: Uuid,
    pub value: String,
    pub created_at: Option<DateTime<Utc>>,
}

// --- Request types ---

#[derive(Debug, Deserialize)]
pub struct SaveProductAttributesRequest {
    pub attributes: Vec<AttributeValueInput>,
}

#[derive(Debug, Deserialize)]
pub struct AttributeValueInput {
    pub attribute_id: Uuid,
    pub value: String,
}

// --- Response types ---

#[derive(Debug, Serialize)]
pub struct BusinessInfoResponse {
    pub company_name: String,
    pub representative: String,
    pub business_number: String,
    pub online_sales_number: String,
    pub address: String,
    pub customer_center: String,
    pub email: String,
    pub escrow_service: EscrowServiceInfo,
}

#[derive(Debug, Serialize)]
pub struct EscrowServiceInfo {
    pub provider: String,
    pub description: String,
}

#[derive(Debug, Serialize)]
pub struct SellerBusinessInfoResponse {
    pub seller_type: String,
    pub business_name: Option<String>,
    pub business_number: Option<String>,
    pub representative_name: Option<String>,
    pub business_address: Option<String>,
    pub business_type: Option<String>,
    pub business_category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProductLegalInfoResponse {
    pub manufacturer: Option<String>,
    pub origin_country: Option<String>,
    pub condition: Option<String>,
    pub kc_certification: Option<serde_json::Value>,
    pub category_attributes: Vec<ProductAttributeDisplay>,
    pub withdrawal_rights: WithdrawalRightsInfo,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ProductAttributeDisplay {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct WithdrawalRightsInfo {
    pub period_days: i32,
    pub conditions: String,
    pub return_shipping_fee: String,
}

impl Default for WithdrawalRightsInfo {
    fn default() -> Self {
        Self {
            period_days: 7,
            conditions: "단순변심 시 7일 이내 청약철회 가능. 사용 또는 훼손 시 불가.".to_string(),
            return_shipping_fee: "구매자 부담 (단순변심) / 판매자 부담 (제품 하자)".to_string(),
        }
    }
}
