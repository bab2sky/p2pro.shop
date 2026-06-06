use bigdecimal::BigDecimal;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct AnalyticsPeriodParams {
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub period: Option<String>, // daily, weekly, monthly
}

#[derive(Debug, Serialize)]
pub struct SalesSummary {
    pub total_sales: BigDecimal,
    pub total_orders: i64,
    pub avg_order_value: BigDecimal,
    pub total_items_sold: i64,
}

#[derive(Debug, Serialize)]
pub struct DailySalesData {
    pub date: NaiveDate,
    pub sales: BigDecimal,
    pub orders: i64,
}

#[derive(Debug, Serialize)]
pub struct TopProduct {
    pub product_id: String,
    pub title: String,
    pub sold_quantity: i64,
    pub revenue: BigDecimal,
}

// Time Deal types
#[derive(Debug, Serialize)]
pub struct TimeDeal {
    pub id: String,
    pub product_id: String,
    pub product_title: String,
    pub deal_price: BigDecimal,
    pub original_price: BigDecimal,
    pub discount_percent: i32,
    pub max_quantity: Option<i32>,
    pub sold_quantity: i32,
    pub starts_at: String,
    pub ends_at: String,
    pub is_active: bool,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateTimeDealRequest {
    pub product_id: uuid::Uuid,
    pub deal_price: BigDecimal,
    pub original_price: BigDecimal,
    pub max_quantity: Option<i32>,
    pub starts_at: String,
    pub ends_at: String,
}

// Regional Surcharge
#[derive(Debug, Serialize)]
pub struct RegionalSurcharge {
    pub id: String,
    pub region_name: String,
    pub zipcode_prefixes: Vec<String>,
    pub surcharge: BigDecimal,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CheckSurchargeRequest {
    pub zipcode: String,
}
