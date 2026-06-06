use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct Settlement {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub order_id: Option<Uuid>,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub settlement_type: String,
    pub amount: BigDecimal,
    pub fee_rate: Option<BigDecimal>,
    pub fee_amount: Option<BigDecimal>,
    pub net_amount: BigDecimal,
    pub wallet_address: Option<String>,
    pub withdrawal_txid: Option<String>,
    pub status: Option<String>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub reject_reason: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WithdrawalRequest {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub amount: BigDecimal,
    pub fee_amount: Option<BigDecimal>,
    pub net_amount: Option<BigDecimal>,
    pub wallet_address: String,
    pub network: String,
    pub txid: Option<String>,
    pub status: String,
    pub reject_reason: Option<String>,
    pub cancel_reason: Option<String>,
    pub admin_memo: Option<String>,
    pub processed_by: Option<Uuid>,
    pub processed_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub requested_at: Option<DateTime<Utc>>,
    /// FR-08: Total count from COUNT(*) OVER() window function
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
    /// Joined seller name (not a DB column)
    #[sqlx(default)]
    pub seller_name: Option<String>,
    /// Joined seller email (not a DB column)
    #[sqlx(default)]
    pub seller_email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SettlementSummary {
    pub total_sales: BigDecimal,
    pub total_commission: BigDecimal,
    pub total_settled: BigDecimal,
    pub available_amount: BigDecimal,
    pub pending_withdrawal: BigDecimal,
    pub commission_rate: BigDecimal,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawalCreateRequest {
    pub amount: BigDecimal,
    pub wallet_address: String,
    pub network: Option<String>,
    pub totp_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawalActionRequest {
    pub action: String, // "approve" | "reject" | "complete" | "cancel"
    pub reason: Option<String>,
    pub txid: Option<String>,
    pub memo: Option<String>,
}

/// Withdrawal statistics for admin dashboard
#[derive(Debug, Serialize)]
pub struct WithdrawalStats {
    pub total_pending: i64,
    pub total_approved: i64,
    pub total_completed: i64,
    pub total_rejected: i64,
    pub total_cancelled: i64,
    pub pending_amount: BigDecimal,
    pub approved_amount: BigDecimal,
    pub completed_amount: BigDecimal,
    pub today_completed_amount: BigDecimal,
    pub month_completed_amount: BigDecimal,
}

/// Calculate seller's available balance (shared helper to avoid duplication)
/// Use `executor` as either `&PgPool` or `&mut PgConnection` (within a transaction)
///
/// v1.2.0: 카테고리별 차등 수수료 지원.
/// 기존에는 단일 글로벌 commission_rate를 받아 total_sales × rate 로 계산했으나,
/// 이제는 orders.commission_amount(주문 생성 시 카테고리 rate로 계산되어 저장된 값)를
/// SUM 하여 per-order 정확한 수수료를 사용한다.
/// `commission_rate_fallback`은 하위 호환을 위해 남겨두며, 표시용 평균 rate 계산과
/// commission_amount 가 NULL 인 legacy 주문 백필 대비용으로만 사용된다.
pub async fn calculate_seller_balance<'e, E>(
    executor: E,
    seller_id: Uuid,
    commission_rate_fallback: &str,
) -> Result<SettlementSummary, sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    // FR-18: 'delivered' + 'confirmed' 포함, refunded 금액 차감
    // C-4 FIX: Include 'completed' withdrawals in total_settled (not just 'approved')
    // to prevent double-withdrawal after completion
    // v1.2.0: total_commission 은 SUM(orders.commission_amount) 로 직접 계산.
    //         migration 037 backfill 이후 모든 주문에 commission_amount 가 채워져 있음.
    // 5개 SUM 결과를 한 번의 쿼리로 받음. 의미가 SQL 구조와 1:1 매칭이라
    // 별도 type alias 보다 인라인이 추적성에 유리.
    #[allow(clippy::type_complexity)]
    let row: (Option<BigDecimal>, Option<BigDecimal>, Option<BigDecimal>, Option<BigDecimal>, Option<BigDecimal>) = sqlx::query_as(
        r#"SELECT
            (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE seller_id = $1 AND status IN ('delivered', 'confirmed')),
            (SELECT COALESCE(SUM(COALESCE(commission_amount, total_amount * COALESCE(commission_rate, 5.00) / 100)), 0)
                FROM orders WHERE seller_id = $1 AND status IN ('delivered', 'confirmed')),
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE seller_id = $1 AND status IN ('approved', 'completed')),
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE seller_id = $1 AND status = 'pending'),
            (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE seller_id = $1 AND status = 'refunded')
        "#,
    )
    .bind(seller_id)
    .fetch_one(executor)
    .await?;

    let total_sales = row.0.unwrap_or_else(|| BigDecimal::from(0));
    let total_commission = row.1.unwrap_or_else(|| BigDecimal::from(0));
    let total_settled = row.2.unwrap_or_else(|| BigDecimal::from(0));
    let pending_withdrawal = row.3.unwrap_or_else(|| BigDecimal::from(0));
    let total_refunded = row.4.unwrap_or_else(|| BigDecimal::from(0));

    // 표시용 평균 commission_rate (UI/요약 응답 호환). 매출 0이면 fallback 사용.
    let display_rate = if total_sales > 0 {
        (&total_commission * BigDecimal::from(100) / &total_sales)
            .with_scale_round(2, bigdecimal::RoundingMode::HalfUp)
    } else {
        BigDecimal::from_str(commission_rate_fallback).map_err(|_| {
            sqlx::Error::Protocol(format!(
                "Invalid commission_rate fallback '{}': must be a valid decimal number",
                commission_rate_fallback
            ))
        })?
    };

    // FR-29: available_amount를 0 이상으로 클램핑 (음수 잔액 방지)
    let available_amount =
        (&total_sales - &total_commission - &total_settled - &pending_withdrawal - &total_refunded)
            .max(BigDecimal::from(0));

    Ok(SettlementSummary {
        total_sales,
        total_commission,
        total_settled,
        available_amount,
        pending_withdrawal,
        commission_rate: display_rate,
    })
}

/// Look up seller_profiles.id from user_id (shared helper — used 8+ times across codebase)
pub async fn get_seller_id(db: &sqlx::PgPool, user_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM seller_profiles WHERE user_id = $1 AND status = 'approved'",
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
}

/// Look up seller_profiles.id from user_id (any status, not just approved)
pub async fn get_seller_id_any_status(
    db: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(db)
        .await
}
