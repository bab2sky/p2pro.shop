use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::category::CategoryBreadcrumb;

/// DDL products table fully mapped
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Product {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub category_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub base_price: BigDecimal,
    pub margin_rate: BigDecimal,
    pub commission_rate: BigDecimal,
    pub final_price: Option<BigDecimal>,
    pub shipping_fee: Option<BigDecimal>,
    pub stock: i32,
    pub sold_count: Option<i32>,
    pub view_count: Option<i32>,
    pub wishlist_count: Option<i32>,
    pub review_count: Option<i32>,
    pub avg_rating: Option<BigDecimal>,
    pub return_policy: Option<String>,
    pub status: Option<String>,
    pub rejected_reason: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    // Phase A: Korean marketplace enhancement
    pub kc_certification: Option<serde_json::Value>,
    pub manufacturer: Option<String>,
    pub origin_country: Option<String>,
    pub condition: Option<String>,
    pub is_draft: Option<bool>,
    pub scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductImage {
    pub id: Uuid,
    pub product_id: Uuid,
    pub image_url: String,
    pub sort_order: i16,
    pub is_main: bool,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductOption {
    pub id: Uuid,
    pub product_id: Uuid,
    pub option_name: String,
    pub option_value: String,
    pub additional_price: Option<BigDecimal>,
    pub stock: i32,
    pub sort_order: i16,
    pub created_at: Option<DateTime<Utc>>,
}

// --- Request types ---

#[derive(Debug, Deserialize)]
pub struct CreateProductRequest {
    pub category_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub base_price: BigDecimal,
    pub margin_rate: BigDecimal,
    pub shipping_fee: Option<BigDecimal>,
    pub stock: i32,
    pub return_policy: Option<String>,
    pub options: Option<Vec<CreateOptionRequest>>,
    // Phase A: Korean marketplace enhancement
    pub manufacturer: Option<String>,
    pub origin_country: Option<String>,
    pub condition: Option<String>,
    pub kc_certification: Option<serde_json::Value>,
    pub search_tags: Option<Vec<String>>,
    pub is_draft: Option<bool>,
    pub scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOptionRequest {
    pub option_name: String,
    pub option_value: String,
    pub additional_price: Option<BigDecimal>,
    pub stock: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    pub category_id: Option<Uuid>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub base_price: Option<BigDecimal>,
    pub margin_rate: Option<BigDecimal>,
    pub shipping_fee: Option<BigDecimal>,
    pub stock: Option<i32>,
    pub return_policy: Option<String>,
    pub status: Option<String>,
}

// --- Response types ---

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductListResponse {
    pub data: Vec<ProductSummary>,
    pub pagination: super::common::Pagination,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ProductSummary {
    pub id: Uuid,
    pub title: String,
    pub final_price: Option<BigDecimal>,
    pub shipping_fee: Option<BigDecimal>,
    pub main_image: Option<String>,
    pub seller_name: Option<String>,
    pub category_name: Option<String>,
    pub stock: i32,
    pub sold_count: Option<i32>,
    pub wishlist_count: Option<i32>,
    pub avg_rating: Option<BigDecimal>,
    pub review_count: Option<i32>,
    pub status: Option<String>,
    pub rejected_reason: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    /// FR-08: Total count from COUNT(*) OVER() window function
    #[serde(skip_serializing)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ProductDetail {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub seller_name: String,
    pub seller_rating: Option<BigDecimal>,
    pub category: Option<CategoryBreadcrumb>,
    pub title: String,
    pub description: Option<String>,
    pub base_price: BigDecimal,
    pub margin_rate: BigDecimal,
    pub commission_rate: BigDecimal,
    pub final_price: Option<BigDecimal>,
    pub shipping_fee: Option<BigDecimal>,
    pub stock: i32,
    pub sold_count: i32,
    pub view_count: i32,
    pub wishlist_count: i32,
    pub avg_rating: Option<BigDecimal>,
    pub review_count: i32,
    pub return_policy: Option<String>,
    pub status: String,
    pub images: Vec<ProductImage>,
    pub options: Vec<ProductOption>,
    pub is_wishlisted: bool,
    pub created_at: Option<DateTime<Utc>>,
    // Phase A: Korean marketplace enhancement
    pub manufacturer: Option<String>,
    pub origin_country: Option<String>,
    pub condition: Option<String>,
    pub kc_certification: Option<serde_json::Value>,
    pub is_draft: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProductResponse {
    pub data: ProductDetail,
}
