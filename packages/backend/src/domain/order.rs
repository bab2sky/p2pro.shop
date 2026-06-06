use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// FR-08: OrderStatus enum — replaces magic string comparisons
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    PendingPayment,
    Verifying,
    PaymentVerified,
    PaymentRejected,
    Paid,
    Shipped,
    Delivered,
    Confirmed,
    Cancelled,
    Refunded,
    Disputed,
}

impl std::fmt::Display for OrderStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OrderStatus::PendingPayment => write!(f, "pending_payment"),
            OrderStatus::Verifying => write!(f, "verifying"),
            OrderStatus::PaymentVerified => write!(f, "payment_verified"),
            OrderStatus::PaymentRejected => write!(f, "payment_rejected"),
            OrderStatus::Paid => write!(f, "paid"),
            OrderStatus::Shipped => write!(f, "shipped"),
            OrderStatus::Delivered => write!(f, "delivered"),
            OrderStatus::Confirmed => write!(f, "confirmed"),
            OrderStatus::Cancelled => write!(f, "cancelled"),
            OrderStatus::Refunded => write!(f, "refunded"),
            OrderStatus::Disputed => write!(f, "disputed"),
        }
    }
}

/// DDL orders table fully mapped
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Order {
    pub id: Uuid,
    pub order_number: String,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub recipient_name: String,
    pub recipient_phone: String,
    pub zipcode: String,
    pub address1: String,
    pub address2: Option<String>,
    pub shipping_memo: Option<String>,
    pub subtotal: BigDecimal,
    pub shipping_fee: BigDecimal,
    pub margin_amount: BigDecimal,
    pub total_amount: BigDecimal,
    pub company_wallet: String,
    pub payment_network: Option<String>,
    pub courier_name: Option<String>,
    pub tracking_number: Option<String>,
    pub shipped_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub status: OrderStatus,
    pub auto_confirm_at: Option<DateTime<Utc>>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub cancel_reason: Option<String>,
    pub seller_memo: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// DDL order_items table fully mapped
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrderItem {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub product_title: String,
    pub option_id: Option<Uuid>,
    pub option_label: Option<String>,
    pub quantity: i32,
    pub unit_price: BigDecimal,
    pub subtotal: BigDecimal,
    pub created_at: Option<DateTime<Utc>>,
}

/// DDL transactions table (subset for Phase 2)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub id: Uuid,
    pub order_id: Uuid,
    pub txid: String,
    pub from_address: Option<String>,
    pub to_address: Option<String>,
    pub amount: Option<BigDecimal>,
    pub token_symbol: Option<String>,
    pub verification_status: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

// --- Request types ---

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub items: Vec<OrderItemRequest>,
    pub address_id: Option<Uuid>,
    /// 주문자 정보 — 인증된 사용자의 nickname/phone 과 일치해야 함 (서버에서 검증)
    pub orderer_name: Option<String>,
    pub orderer_phone: Option<String>,
    pub recipient_name: String,
    pub recipient_phone: String,
    pub zipcode: String,
    pub address1: String,
    pub address2: Option<String>,
    pub shipping_memo: Option<String>,
    /// FR-03: 쿠폰 적용
    pub coupon_id: Option<Uuid>,
    /// Payment network: "ERC-20", "TRC-20", "BEP-20"
    pub payment_network: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OrderItemRequest {
    pub product_id: Uuid,
    pub option_id: Option<Uuid>,
    pub quantity: i32,
    /// FR-12: 프론트에서 보낸 가격과 실제 가격 비교
    pub expected_price: Option<BigDecimal>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitTxidRequest {
    pub txid: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNetworkRequest {
    pub payment_network: String,
}

// --- Response types ---

#[derive(Debug, Serialize)]
pub struct OrderListResponse {
    pub data: Vec<OrderSummary>,
    pub pagination: super::common::Pagination,
}

#[derive(Debug, Serialize, FromRow)]
pub struct OrderSummary {
    pub id: Uuid,
    pub order_number: String,
    pub status: OrderStatus,
    pub total_amount: BigDecimal,
    pub item_count: Option<i64>,
    pub first_item_title: Option<String>,
    pub first_item_image: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    /// Window function total for eliminating separate COUNT query
    #[serde(skip_serializing)]
    pub total_count: Option<i64>,
}

/// Seller-enriched order summary with buyer, TXID, and shipping info
#[derive(Debug, Serialize, FromRow)]
pub struct SellerOrderSummary {
    pub id: Uuid,
    pub order_number: String,
    pub status: OrderStatus,
    pub total_amount: BigDecimal,
    pub subtotal: BigDecimal,
    pub shipping_fee: BigDecimal,
    pub margin_amount: BigDecimal,
    pub item_count: Option<i64>,
    pub first_item_title: Option<String>,
    pub first_item_image: Option<String>,
    // buyer info
    pub buyer_nickname: Option<String>,
    pub recipient_name: String,
    pub recipient_phone: String,
    // TXID info
    pub txid: Option<String>,
    pub verification_status: Option<String>,
    // shipping info
    pub carrier_name: Option<String>,
    pub tracking_number: Option<String>,
    pub shipped_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub auto_confirm_at: Option<DateTime<Utc>>,
    pub confirmed_at: Option<DateTime<Utc>>,
    // timestamps
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    /// Window function total for eliminating separate COUNT query
    #[serde(skip_serializing)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SellerOrderListResponse {
    pub data: Vec<SellerOrderSummary>,
    pub pagination: super::common::Pagination,
}

#[derive(Debug, Serialize)]
pub struct OrderDetail {
    pub id: Uuid,
    pub order_number: String,
    pub status: OrderStatus,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub seller_name: String,
    pub recipient_name: String,
    pub recipient_phone: String,
    pub zipcode: String,
    pub address1: String,
    pub address2: Option<String>,
    pub shipping_memo: Option<String>,
    pub items: Vec<OrderItemDetail>,
    pub subtotal: BigDecimal,
    pub shipping_fee: BigDecimal,
    pub margin_amount: BigDecimal,
    pub total_amount: BigDecimal,
    pub company_wallet: String,
    pub payment_network: Option<String>,
    pub txid: Option<String>,
    pub timeline: Vec<OrderEvent>,
    pub txid_deadline: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    /// v1.3.6: 모든 아이템이 디지털 카테고리인지. true 면 셀러가 운송장 없이 즉시 배송완료 가능.
    pub is_digital: bool,
}

#[derive(Debug, Serialize)]
pub struct OrderItemDetail {
    pub product_id: Uuid,
    pub product_title: String,
    pub product_image: Option<String>,
    pub option_label: Option<String>,
    pub quantity: i32,
    pub unit_price: BigDecimal,
    pub subtotal: BigDecimal,
}

#[derive(Debug, Serialize)]
pub struct OrderEvent {
    pub status: String,
    pub label: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct OrderCreatedResponse {
    pub data: OrderCreatedData,
}

#[derive(Debug, Serialize)]
pub struct OrderCreatedData {
    pub orders: Vec<OrderCreatedItem>,
}

#[derive(Debug, Serialize)]
pub struct OrderCreatedItem {
    pub id: Uuid,
    pub order_number: String,
    pub seller_name: String,
    pub total_amount: BigDecimal,
    pub company_wallet: String,
    pub payment_network: Option<String>,
    pub txid_deadline: DateTime<Utc>,
    pub items: Vec<OrderItemDetail>,
}
