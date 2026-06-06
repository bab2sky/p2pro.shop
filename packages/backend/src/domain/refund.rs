// from_str → Option<Self> 패턴, FromStr trait 미구현 사유는 dispute.rs 와 동일.
#![allow(clippy::should_implement_trait)]

use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- Enums ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RefundStatus {
    Requested,
    SellerApproved,
    SellerRejected,
    AdminProcessing,
    AdminCompleted,
    AdminRejected,
}

impl RefundStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Requested => "requested",
            Self::SellerApproved => "seller_approved",
            Self::SellerRejected => "seller_rejected",
            Self::AdminProcessing => "admin_processing",
            Self::AdminCompleted => "admin_completed",
            Self::AdminRejected => "admin_rejected",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "requested" => Some(Self::Requested),
            "seller_approved" => Some(Self::SellerApproved),
            "seller_rejected" => Some(Self::SellerRejected),
            "admin_processing" => Some(Self::AdminProcessing),
            "admin_completed" => Some(Self::AdminCompleted),
            "admin_rejected" => Some(Self::AdminRejected),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RefundReasonCode {
    Defective,
    WrongItem,
    NotDelivered,
    NotAsDescribed,
    ChangeOfMind,
    Other,
}

impl RefundReasonCode {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "defective" => Some(Self::Defective),
            "wrong_item" => Some(Self::WrongItem),
            "not_delivered" => Some(Self::NotDelivered),
            "not_as_described" => Some(Self::NotAsDescribed),
            "change_of_mind" => Some(Self::ChangeOfMind),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

// --- Domain structs ---

#[derive(Debug, Serialize, FromRow)]
pub struct RefundRequest {
    pub id: Uuid,
    pub order_id: Uuid,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub reason_code: String,
    pub reason: String,
    pub evidence_images: Option<serde_json::Value>,
    pub status: String,
    pub seller_response: Option<String>,
    pub seller_reason: Option<String>,
    pub seller_responded_at: Option<DateTime<Utc>>,
    pub refund_type: Option<String>,
    pub refund_amount: Option<BigDecimal>,
    pub admin_note: Option<String>,
    pub processed_by: Option<Uuid>,
    pub processed_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

/// Extended view with order/user info for list pages
#[derive(Debug, Serialize, FromRow)]
pub struct RefundRequestWithInfo {
    pub id: Uuid,
    pub order_id: Uuid,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub reason_code: String,
    pub reason: String,
    pub evidence_images: Option<serde_json::Value>,
    pub status: String,
    pub seller_response: Option<String>,
    pub seller_reason: Option<String>,
    pub seller_responded_at: Option<DateTime<Utc>>,
    pub refund_type: Option<String>,
    pub refund_amount: Option<BigDecimal>,
    pub admin_note: Option<String>,
    pub processed_by: Option<Uuid>,
    pub processed_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    // Joined fields
    pub order_number: Option<String>,
    pub order_total: Option<BigDecimal>,
    pub order_status: Option<String>,
    pub buyer_name: Option<String>,
    pub seller_name: Option<String>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

// --- Request types ---

#[derive(Debug, Deserialize)]
pub struct CreateRefundRequest {
    pub reason_code: String,
    pub reason: String,
    pub evidence_images: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SellerRefundResponse {
    pub action: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdminRefundProcess {
    pub action: String,
    pub refund_type: Option<String>,
    pub refund_amount: Option<BigDecimal>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RefundListQuery {
    pub status: Option<String>,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

impl RefundListQuery {
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1) as i64
    }
    pub fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(20).clamp(1, 100) as i64
    }
    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.per_page()
    }
}

#[derive(Debug, Serialize)]
pub struct RefundStats {
    pub total_requested: i64,
    pub pending_seller: i64,
    pub seller_approved: i64,
    pub admin_pending: i64,
    pub completed: i64,
    pub rejected: i64,
    pub total_refunded_amount: BigDecimal,
}

// --- Query helpers ---

const REFUND_SELECT_COLUMNS: &str = r#"id, order_id, buyer_id, seller_id, reason_code, reason, evidence_images,
       status, seller_response, seller_reason, seller_responded_at,
       refund_type, refund_amount, admin_note, processed_by, processed_at,
       created_at, updated_at"#;

pub const REFUND_WITH_INFO_SELECT: &str = r#"rr.id, rr.order_id, rr.buyer_id, rr.seller_id, rr.reason_code, rr.reason,
       rr.evidence_images, rr.status, rr.seller_response, rr.seller_reason,
       rr.seller_responded_at, rr.refund_type, rr.refund_amount, rr.admin_note,
       rr.processed_by, rr.processed_at, rr.created_at, rr.updated_at,
       o.order_number, o.total_amount as order_total, o.status::TEXT as order_status,
       COALESCE(bu.nickname, bu.real_name, bu.username) as buyer_name,
       COALESCE(su.nickname, su.real_name, su.username) as seller_name,
       COUNT(*) OVER() as total_count"#;

pub const REFUND_WITH_INFO_JOIN: &str = r#"FROM refund_requests rr
       JOIN orders o ON o.id = rr.order_id
       JOIN users bu ON bu.id = rr.buyer_id
       JOIN seller_profiles sp ON sp.id = rr.seller_id
       JOIN users su ON su.id = sp.user_id"#;

pub async fn find_refund_by_id(
    db: &sqlx::PgPool,
    id: Uuid,
) -> Result<Option<RefundRequest>, sqlx::Error> {
    let query = format!(
        "SELECT {} FROM refund_requests WHERE id = $1",
        REFUND_SELECT_COLUMNS
    );
    sqlx::query_as::<_, RefundRequest>(&query)
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_refund_by_order_id(
    db: &sqlx::PgPool,
    order_id: Uuid,
) -> Result<Option<RefundRequest>, sqlx::Error> {
    let query = format!(
        "SELECT {} FROM refund_requests WHERE order_id = $1",
        REFUND_SELECT_COLUMNS
    );
    sqlx::query_as::<_, RefundRequest>(&query)
        .bind(order_id)
        .fetch_optional(db)
        .await
}
