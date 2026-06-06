use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use bigdecimal::BigDecimal;
use serde_json::json;
use std::str::FromStr;
use uuid::Uuid;

use crate::domain::common::PaginationParams;
use crate::domain::settlement::{self, *};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Fixed withdrawal fee rate (5%) — separate from sales commission rate.
/// Audit C1 (2026-05-07): admin/finance.rs 가 잘못 commission_rate (sales) 를
/// 사용하던 것을 이 함수로 통일. 향후 system_settings.withdrawal_fee_rate 키
/// 와 연동 시 단일 호출 지점만 변경하면 됨.
pub fn withdrawal_fee_rate() -> BigDecimal {
    BigDecimal::from_str("0.05").unwrap()
}

/// Seller settlement routes (require authenticated seller)
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/settlement/summary", get(settlement_summary))
        .route("/settlement/history", get(settlement_history))
        .route("/withdrawal", post(create_withdrawal))
        .route("/withdrawal", get(list_my_withdrawals))
}

// --- Settlement Summary ---

async fn settlement_summary(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Use shared helper to get seller_id
    let seller_id = settlement::get_seller_id(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    // Use shared helper to calculate balance (eliminates 4x query duplication)
    let summary =
        settlement::calculate_seller_balance(&state.db, seller_id, &state.config.commission_rate)
            .await
            .map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Balance calculation failed: {}", e))
            })?;

    Ok(Json(json!({ "data": summary })))
}

// --- Settlement History (withdrawal requests) ---

async fn settlement_history(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_id = settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM withdrawal_requests WHERE seller_id = $1",
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    let withdrawals = sqlx::query_as::<_, WithdrawalRequest>(
        r#"SELECT id, seller_id, amount, fee_amount, net_amount,
                  wallet_address, network, txid, status,
                  reject_reason, cancel_reason, admin_memo,
                  processed_by, processed_at, completed_at, cancelled_at,
                  requested_at
           FROM withdrawal_requests
           WHERE seller_id = $1
           ORDER BY requested_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(seller_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({
        "data": withdrawals,
        "pagination": crate::domain::common::Pagination::new(page, per_page, total),
    })))
}

// --- Create Withdrawal ---

async fn create_withdrawal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<WithdrawalCreateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // CRIT-12: 2FA MUST be enabled for withdrawals (business rule)
    let totp_enabled = sqlx::query_scalar::<_, Option<bool>>(
        "SELECT is_enabled FROM user_totp WHERE user_id = $1",
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?
    .flatten()
    .unwrap_or(false);

    if !totp_enabled {
        return Err(AppError::Validation {
            message: "2FA must be enabled before withdrawals. Please enable 2FA first.".into(),
            field: Some("totp_code".into()),
        });
    }

    let totp_code = req.totp_code.as_deref().unwrap_or("");
    if totp_code.is_empty() {
        return Err(AppError::Validation {
            message: "2FA code is required for withdrawals".into(),
            field: Some("totp_code".into()),
        });
    }
    crate::middleware::totp::verify_totp(
        &state.db,
        auth.id,
        totp_code,
        &state.config.totp_encryption_key,
    )
    .await?;

    let commission_rate = &state.config.commission_rate;
    let min_amount = &state.config.min_settlement_amount;

    // FR-27: wallet address 정규식 검증 (ERC-20/TRC-20)
    crate::domain::wallet::validate_wallet_address(&req.wallet_address)?;

    // W-1/W-2 FIX: Parse min_settlement_amount directly from String → BigDecimal (no f64 intermediate)
    let min_bd = BigDecimal::from_str(min_amount).unwrap_or_else(|_| BigDecimal::from(10));
    if req.amount < min_bd {
        return Err(AppError::Validation {
            message: format!("Minimum withdrawal amount is ${}", min_amount),
            field: Some("amount".into()),
        });
    }

    // CRIT-01: Use DB transaction with FOR UPDATE to prevent race condition
    let mut tx = state.db.begin().await?;

    // Lock seller row to serialize concurrent withdrawal requests
    let seller_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM seller_profiles WHERE user_id = $1 AND status = 'approved' FOR UPDATE",
    )
    .bind(auth.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    // Calculate available amount within the transaction (uses shared helper)
    let balance = settlement::calculate_seller_balance(&mut *tx, seller_id, commission_rate)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Balance calculation failed: {}", e)))?;

    let available = balance.available_amount;

    if req.amount > available {
        return Err(AppError::Validation {
            message: "Withdrawal amount exceeds available balance".into(),
            field: Some("amount".into()),
        });
    }

    // FR-17: 출금 수수료 적용 (C-2: use fixed 5% withdrawal fee, not sales commission rate)
    let fee_rate = withdrawal_fee_rate();
    let fee_amount = &req.amount * &fee_rate;
    let net_amount = &req.amount - &fee_amount;

    let id = Uuid::new_v4();
    let network = req.network.unwrap_or_else(|| "trc20".to_string());

    sqlx::query(
        r#"INSERT INTO withdrawal_requests (id, seller_id, amount, fee_amount, net_amount, wallet_address, network, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')"#,
    )
    .bind(id)
    .bind(seller_id)
    .bind(&req.amount)
    .bind(&fee_amount)
    .bind(&net_amount)
    .bind(&req.wallet_address)
    .bind(&network)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "data": {
            "id": id,
            "amount": req.amount,
            "fee_amount": fee_amount,
            "net_amount": net_amount,
            "wallet_address": req.wallet_address,
            "network": network,
            "status": "pending"
        }
    })))
}

// --- List My Withdrawals ---

async fn list_my_withdrawals(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller_id = settlement::get_seller_id_any_status(&state.db, auth.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM withdrawal_requests WHERE seller_id = $1",
    )
    .bind(seller_id)
    .fetch_one(&state.db)
    .await?;

    let withdrawals = sqlx::query_as::<_, WithdrawalRequest>(
        r#"SELECT id, seller_id, amount, fee_amount, net_amount,
                  wallet_address, network, txid, status,
                  reject_reason, cancel_reason, admin_memo,
                  processed_by, processed_at, completed_at, cancelled_at,
                  requested_at
           FROM withdrawal_requests
           WHERE seller_id = $1
           ORDER BY requested_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(seller_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({
        "data": withdrawals,
        "pagination": crate::domain::common::Pagination::new(page, per_page, total),
    })))
}
