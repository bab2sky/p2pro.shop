// 도메인 enum 의 from_str(&str) -> Option<Self> 패턴은 std::str::FromStr 의
// Result<Self, Self::Err> 시그니처와 다르고, 파싱 실패 시 None 반환이 더
// 직관적이라 일부러 trait 구현 대신 inherent method 로 둠. clippy 경고 무시.
#![allow(clippy::should_implement_trait)]

use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- Enums ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisputeType {
    NotDelivered,
    Defective,
    WrongItem,
    Other,
}

impl DisputeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::NotDelivered => "not_delivered",
            Self::Defective => "defective",
            Self::WrongItem => "wrong_item",
            Self::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "not_delivered" => Some(Self::NotDelivered),
            "defective" => Some(Self::Defective),
            "wrong_item" => Some(Self::WrongItem),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisputeStatus {
    Open,
    Responded,
    UnderReview,
    Resolved,
    Closed,
}

impl DisputeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Responded => "responded",
            Self::UnderReview => "under_review",
            Self::Resolved => "resolved",
            Self::Closed => "closed",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "open" => Some(Self::Open),
            "responded" => Some(Self::Responded),
            "under_review" => Some(Self::UnderReview),
            "resolved" => Some(Self::Resolved),
            "closed" => Some(Self::Closed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisputeResolution {
    BuyerWin,
    SellerWin,
    PartialRefund,
    MutualAgreement,
}

impl DisputeResolution {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::BuyerWin => "buyer_win",
            Self::SellerWin => "seller_win",
            Self::PartialRefund => "partial_refund",
            Self::MutualAgreement => "mutual_agreement",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "buyer_win" => Some(Self::BuyerWin),
            "seller_win" => Some(Self::SellerWin),
            "partial_refund" => Some(Self::PartialRefund),
            "mutual_agreement" => Some(Self::MutualAgreement),
            _ => None,
        }
    }
}

// --- Domain structs ---

#[derive(Debug, Serialize, FromRow)]
pub struct Dispute {
    pub id: Uuid,
    pub order_id: Uuid,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub dispute_type: String,
    pub reason: String,
    pub evidence_files: Option<Vec<String>>,
    pub status: String,
    pub resolution: Option<String>,
    pub resolution_detail: Option<String>,
    pub refund_amount: Option<BigDecimal>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DisputeMessage {
    pub id: Uuid,
    pub dispute_id: Uuid,
    pub sender_id: Uuid,
    pub sender_role: String,
    pub content: String,
    pub attachments: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct DisputeWithMessages {
    pub dispute: Dispute,
    pub messages: Vec<DisputeMessage>,
}

// --- Request types ---

#[derive(Debug, Deserialize)]
pub struct DisputeCreateRequest {
    pub order_id: Uuid,
    pub dispute_type: String,
    pub reason: String,
    pub evidence: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct DisputeResolveRequest {
    pub resolution: String,
    pub resolution_detail: Option<String>,
    pub refund_amount: Option<BigDecimal>,
}

#[derive(Debug, Deserialize)]
pub struct DisputeMessageRequest {
    pub content: String,
    pub attachments: Option<Vec<String>>,
}

// --- Query types ---

#[derive(Debug, Deserialize)]
pub struct DisputeListQuery {
    pub status: Option<String>,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

// --- FR-22: Shared query helpers ---

const DISPUTE_SELECT_COLUMNS: &str = r#"id, order_id, buyer_id, seller_id, dispute_type,
       reason, evidence_files, status, resolution, resolution_detail,
       refund_amount, resolved_by, resolved_at, created_at, updated_at"#;

pub async fn find_dispute_by_id(
    db: &sqlx::PgPool,
    id: Uuid,
) -> Result<Option<Dispute>, sqlx::Error> {
    let query = format!(
        "SELECT {} FROM disputes WHERE id = $1",
        DISPUTE_SELECT_COLUMNS
    );
    sqlx::query_as::<_, Dispute>(&query)
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_dispute_messages(
    db: &sqlx::PgPool,
    dispute_id: Uuid,
) -> Result<Vec<DisputeMessage>, sqlx::Error> {
    sqlx::query_as::<_, DisputeMessage>(
        r#"SELECT id, dispute_id, sender_id, sender_role, content, attachments, created_at
           FROM dispute_messages
           WHERE dispute_id = $1
           ORDER BY created_at ASC"#,
    )
    .bind(dispute_id)
    .fetch_all(db)
    .await
}
