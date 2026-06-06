use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CartItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub product_id: Uuid,
    pub option_id: Option<Uuid>,
    pub quantity: i32,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct AddToCartRequest {
    pub product_id: Uuid,
    pub option_id: Option<Uuid>,
    pub quantity: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCartRequest {
    pub quantity: i32,
}

#[derive(Debug, Serialize)]
pub struct CartResponse {
    pub data: Vec<CartGroup>,
}

#[derive(Debug, Serialize)]
pub struct CartGroup {
    pub seller_id: Uuid,
    pub seller_name: String,
    pub items: Vec<CartItemDetail>,
    pub subtotal: BigDecimal,
    pub shipping_fee: BigDecimal,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CartItemDetail {
    pub id: Uuid,
    pub product_id: Uuid,
    pub product_title: Option<String>,
    pub product_image: Option<String>,
    pub option_id: Option<Uuid>,
    pub option_label: Option<String>,
    pub unit_price: Option<BigDecimal>,
    pub quantity: i32,
    pub subtotal: Option<BigDecimal>,
    pub stock: Option<i32>,
    pub seller_id: Option<Uuid>,
    pub seller_name: Option<String>,
    pub shipping_fee: Option<BigDecimal>,
    pub category_name: Option<String>,
}
