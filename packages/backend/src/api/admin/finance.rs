//! Withdrawal management and dispute resolution

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    Extension, Json,
};
use chrono;
use serde_json::json;
use std::net::SocketAddr;
use uuid::Uuid;

use super::{extract_ip, search_pattern};
use crate::domain::admin::*;
use crate::domain::common::Pagination;
use crate::domain::notification::create_notification;
use crate::domain::settlement::{
    self, WithdrawalActionRequest, WithdrawalRequest, WithdrawalStats,
};
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};
use bigdecimal::BigDecimal;

// --- Withdrawal Management ---

pub async fn list_withdrawals(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("");

    // FR-08: Single query with COUNT(*) OVER(), join seller name
    let withdrawals = if status_filter.is_empty() || status_filter == "all" {
        sqlx::query_as::<_, WithdrawalRequest>(
            r#"SELECT wr.id, wr.seller_id, wr.amount, wr.fee_amount, wr.net_amount,
                      wr.wallet_address, wr.network, wr.txid, wr.status,
                      wr.reject_reason, wr.cancel_reason, wr.admin_memo,
                      wr.processed_by, wr.processed_at, wr.completed_at, wr.cancelled_at,
                      wr.requested_at,
                      COALESCE(u.nickname, u.real_name, u.username) as seller_name,
                      u.email as seller_email,
                      COUNT(*) OVER() as total_count
               FROM withdrawal_requests wr
               JOIN seller_profiles sp ON sp.id = wr.seller_id
               JOIN users u ON u.id = sp.user_id
               ORDER BY wr.requested_at DESC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, WithdrawalRequest>(
            r#"SELECT wr.id, wr.seller_id, wr.amount, wr.fee_amount, wr.net_amount,
                      wr.wallet_address, wr.network, wr.txid, wr.status,
                      wr.reject_reason, wr.cancel_reason, wr.admin_memo,
                      wr.processed_by, wr.processed_at, wr.completed_at, wr.cancelled_at,
                      wr.requested_at,
                      COALESCE(u.nickname, u.real_name, u.username) as seller_name,
                      u.email as seller_email,
                      COUNT(*) OVER() as total_count
               FROM withdrawal_requests wr
               JOIN seller_profiles sp ON sp.id = wr.seller_id
               JOIN users u ON u.id = sp.user_id
               WHERE wr.status = $1
               ORDER BY wr.requested_at DESC
               LIMIT $2 OFFSET $3"#,
        )
        .bind(status_filter)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    };

    let total = withdrawals.first().and_then(|w| w.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": withdrawals,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

/// GET /admin/withdrawals/stats — withdrawal statistics
pub async fn withdrawal_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>, Option<i64>, Option<i64>,
                                      Option<BigDecimal>, Option<BigDecimal>, Option<BigDecimal>,
                                      Option<BigDecimal>, Option<BigDecimal>)>(
        r#"SELECT
            (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending'),
            (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'approved'),
            (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'completed'),
            (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'rejected'),
            (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'cancelled'),
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'pending'),
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'approved'),
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'completed'),
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'completed' AND completed_at >= DATE_TRUNC('month', CURRENT_DATE))
        "#,
    )
    .fetch_one(&state.db)
    .await?;

    let result = WithdrawalStats {
        total_pending: stats.0.unwrap_or(0),
        total_approved: stats.1.unwrap_or(0),
        total_completed: stats.2.unwrap_or(0),
        total_rejected: stats.3.unwrap_or(0),
        total_cancelled: stats.4.unwrap_or(0),
        pending_amount: stats.5.unwrap_or_else(|| BigDecimal::from(0)),
        approved_amount: stats.6.unwrap_or_else(|| BigDecimal::from(0)),
        completed_amount: stats.7.unwrap_or_else(|| BigDecimal::from(0)),
        today_completed_amount: stats.8.unwrap_or_else(|| BigDecimal::from(0)),
        month_completed_amount: stats.9.unwrap_or_else(|| BigDecimal::from(0)),
    };

    Ok(Json(json!({ "data": result })))
}

pub async fn process_withdrawal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<WithdrawalActionRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));
    let commission_rate = &state.config.commission_rate;

    match req.action.as_str() {
        "approve" => {
            let mut tx = state.db.begin().await?;

            let wr = sqlx::query_as::<_, (Uuid, bigdecimal::BigDecimal)>(
                "SELECT seller_id, amount FROM withdrawal_requests WHERE id = $1 AND status = 'pending' FOR UPDATE",
            ).bind(id).fetch_optional(&mut *tx).await?;

            let (seller_id, amount) = wr.ok_or_else(|| {
                AppError::NotFound("Withdrawal request not found or not pending".into())
            })?;

            // Audit C1 (2026-05-07): 출금 수수료는 판매 수수료 (commission_rate)
            // 와 분리. 판매자 신청 시점 (settlements.rs::create_withdrawal) 과 동일
            // 한 5% 고정 율을 사용해서 신청-승인 사이 net_amount 가 어긋나지 않도록.
            let fee_rate = crate::api::settlements::withdrawal_fee_rate();
            let fee_amount =
                (&amount * &fee_rate).with_scale_round(2, bigdecimal::RoundingMode::HalfUp);
            let net_amount = &amount - &fee_amount;

            // GAP-09 FIX: Use calculate_seller_balance() as single source of truth
            // This matches the same check used in create_withdrawal (seller API)
            let balance =
                settlement::calculate_seller_balance(&mut *tx, seller_id, commission_rate)
                    .await
                    .map_err(|e| {
                        AppError::Internal(anyhow::anyhow!("Balance calculation failed: {}", e))
                    })?;

            // available_amount already excludes this pending withdrawal,
            // so if it's >= 0, the seller has sufficient funds
            if balance.available_amount < 0 {
                return Err(AppError::Validation {
                    message: "Insufficient seller balance for withdrawal".into(),
                    field: Some("amount".into()),
                });
            }

            // Round 4 (M4): seller_profiles.balance 캐시 컬럼 deprecated.
            // 모든 read 가 settlement.rs::compute_settlement_summary 로 매번
            // 재계산이라 이 sync 는 no-op. 향후 v2 에서 컬럼 자체 DROP.

            // Approve with fee info and optional memo
            sqlx::query(
                r#"UPDATE withdrawal_requests SET
                    status = 'approved', fee_amount = $1, net_amount = $2,
                    admin_memo = $3, processed_by = $4, processed_at = NOW()
                   WHERE id = $5"#,
            )
            .bind(&fee_amount)
            .bind(&net_amount)
            .bind(&req.memo)
            .bind(auth.id)
            .bind(id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;

            if let Some(uid) = get_seller_user_id(&state.db, id).await? {
                let _ = create_notification(
                    &state.db,
                    Some(&state.ws_hub),
                    uid,
                    "settlement",
                    "출금 승인",
                    &format!(
                        "출금 요청이 승인되었습니다. (출금액: ${}, 수수료: ${})",
                        net_amount, fee_amount
                    ),
                    Some("/seller/settlement"),
                )
                .await;
            }

            log_admin_action(
                &state.db,
                auth.id,
                "withdrawal_approve",
                "withdrawal",
                id,
                Some(
                    json!({ "amount": amount, "fee_amount": fee_amount, "net_amount": net_amount }),
                ),
                ip,
            )
            .await?;

            Ok(Json(
                json!({ "data": { "id": id, "status": "approved", "fee_amount": fee_amount, "net_amount": net_amount } }),
            ))
        }
        "complete" => {
            // Mark approved withdrawal as completed (after actual USDT transfer)
            let txid = req.txid.as_deref().unwrap_or("");
            if txid.is_empty() {
                return Err(AppError::Validation {
                    message: "TXID is required to complete withdrawal".into(),
                    field: Some("txid".into()),
                });
            }

            let result = sqlx::query(
                r#"UPDATE withdrawal_requests SET
                    status = 'completed', txid = $1, admin_memo = COALESCE($2, admin_memo),
                    completed_at = NOW()
                   WHERE id = $3 AND status = 'approved'"#,
            )
            .bind(txid)
            .bind(&req.memo)
            .bind(id)
            .execute(&state.db)
            .await?;

            if result.rows_affected() == 0 {
                return Err(AppError::NotFound(
                    "Withdrawal not found or not in approved status".into(),
                ));
            }

            if let Some(uid) = get_seller_user_id(&state.db, id).await? {
                let _ = create_notification(
                    &state.db,
                    Some(&state.ws_hub),
                    uid,
                    "settlement",
                    "출금 완료",
                    "출금이 완료되었습니다. 지갑을 확인해주세요.",
                    Some("/seller/settlement"),
                )
                .await;

                // Fetch amount for email
                let amount = sqlx::query_scalar::<_, BigDecimal>(
                    "SELECT net_amount FROM withdrawal_requests WHERE id = $1",
                )
                .bind(id)
                .fetch_optional(&state.db)
                .await?
                .unwrap_or_else(|| BigDecimal::from(0));

                let _ = crate::domain::email::queue_email(
                    &state.db,
                    uid,
                    crate::domain::email::EmailTemplate::SettlementComplete {
                        amount: amount.to_string(),
                        date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
                    },
                )
                .await;
            }

            log_admin_action(
                &state.db,
                auth.id,
                "withdrawal_complete",
                "withdrawal",
                id,
                Some(json!({ "txid": txid })),
                ip,
            )
            .await?;

            Ok(Json(
                json!({ "data": { "id": id, "status": "completed", "txid": txid } }),
            ))
        }
        "reject" => {
            let reason = req.reason.as_deref().unwrap_or("관리자 거부");

            let result = sqlx::query(
                r#"UPDATE withdrawal_requests SET
                    status = 'rejected', reject_reason = $1, admin_memo = $2,
                    processed_by = $3, processed_at = NOW()
                   WHERE id = $4 AND status = 'pending'"#,
            )
            .bind(reason)
            .bind(&req.memo)
            .bind(auth.id)
            .bind(id)
            .execute(&state.db)
            .await?;

            if result.rows_affected() == 0 {
                return Err(AppError::NotFound(
                    "Withdrawal request not found or not pending".into(),
                ));
            }

            if let Some(uid) = get_seller_user_id(&state.db, id).await? {
                let msg = format!("출금 요청이 거부되었습니다. 사유: {}", reason);
                let _ = create_notification(
                    &state.db,
                    Some(&state.ws_hub),
                    uid,
                    "settlement",
                    "출금 거부",
                    &msg,
                    Some("/seller/settlement"),
                )
                .await;
            }

            log_admin_action(
                &state.db,
                auth.id,
                "withdrawal_reject",
                "withdrawal",
                id,
                Some(json!({ "reason": reason })),
                ip,
            )
            .await?;

            Ok(Json(
                json!({ "data": { "id": id, "status": "rejected", "reject_reason": reason } }),
            ))
        }
        "cancel" => {
            // Cancel: revert balance for approved (not yet completed) withdrawals,
            // or simply cancel pending ones
            let reason = req.reason.as_deref().unwrap_or("관리자 취소");

            let mut tx = state.db.begin().await?;

            let wr = sqlx::query_as::<_, (Uuid, bigdecimal::BigDecimal, String)>(
                "SELECT seller_id, amount, status FROM withdrawal_requests WHERE id = $1 AND status IN ('pending', 'approved') FOR UPDATE",
            ).bind(id).fetch_optional(&mut *tx).await?;

            // seller_id 는 Round 4 에서 balance 캐시 동기화 제거 후 미사용.
            let (_seller_id, _amount, prev_status) = wr.ok_or_else(|| {
                AppError::NotFound("Withdrawal not found or already completed/rejected".into())
            })?;

            // Cancel the withdrawal first
            sqlx::query(
                r#"UPDATE withdrawal_requests SET
                    status = 'cancelled', cancel_reason = $1, admin_memo = $2,
                    cancelled_at = NOW()
                   WHERE id = $3"#,
            )
            .bind(reason)
            .bind(&req.memo)
            .bind(id)
            .execute(&mut *tx)
            .await?;

            // GAP-09 FIX: Recalculate and sync balance after cancellation
            // This automatically restores balance for both pending and approved cancellations
            // Round 4 (M4): balance 캐시 컬럼 deprecated.
            // calculate_seller_balance 결과를 read 시 매번 재계산하므로
            // 동기화 불필요.

            tx.commit().await?;

            if let Some(uid) = get_seller_user_id(&state.db, id).await? {
                let msg = format!("출금 요청이 취소되었습니다. 사유: {}", reason);
                let _ = create_notification(
                    &state.db,
                    Some(&state.ws_hub),
                    uid,
                    "settlement",
                    "출금 취소",
                    &msg,
                    Some("/seller/settlement"),
                )
                .await;
            }

            log_admin_action(&state.db, auth.id, "withdrawal_cancel", "withdrawal", id,
                Some(json!({ "reason": reason, "prev_status": prev_status, "refunded": prev_status == "approved" })), ip).await?;

            Ok(Json(
                json!({ "data": { "id": id, "status": "cancelled", "cancel_reason": reason } }),
            ))
        }
        _ => Err(AppError::Validation {
            message: "action must be 'approve', 'complete', 'reject', or 'cancel'".into(),
            field: Some("action".into()),
        }),
    }
}

/// Helper: get user_id from withdrawal_request via seller_profiles join
async fn get_seller_user_id(
    db: &sqlx::PgPool,
    withdrawal_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT sp.user_id FROM withdrawal_requests wr JOIN seller_profiles sp ON sp.id = wr.seller_id WHERE wr.id = $1",
    ).bind(withdrawal_id).fetch_optional(db).await?)
}

// --- Dispute Admin ---

pub async fn admin_dispute_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let row = sqlx::query_as::<_, (i64, i64, i64, i64, i64)>(
        r#"SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'open') as open_disputes,
            COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
            COUNT(*) FILTER (WHERE status = 'closed') as closed
           FROM disputes"#,
    )
    .fetch_one(&state.db)
    .await?;

    let refund_total = sqlx::query_scalar::<_, Option<bigdecimal::BigDecimal>>(
        "SELECT SUM(refund_amount) FROM disputes WHERE refund_amount IS NOT NULL AND status IN ('resolved', 'closed')",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "data": {
            "total": row.0,
            "open": row.1,
            "in_progress": row.2,
            "resolved": row.3,
            "closed": row.4,
            "total_refund_amount": refund_total.map(|v| v.to_string()).unwrap_or_else(|| "0".to_string())
        }
    })))
}

pub async fn admin_list_disputes(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("");

    // M-2 FIX: Use exact match (=) for enum-like status, not LIKE
    let disputes = if status_filter.is_empty() || status_filter == "all" {
        sqlx::query_as::<_, crate::domain::dispute::Dispute>(
            r#"SELECT id, order_id, buyer_id, seller_id, dispute_type,
                      reason, evidence_files, status, resolution, resolution_detail,
                      refund_amount, resolved_by, resolved_at, created_at, updated_at,
                      COUNT(*) OVER() as total_count
               FROM disputes
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, crate::domain::dispute::Dispute>(
            r#"SELECT id, order_id, buyer_id, seller_id, dispute_type,
                      reason, evidence_files, status, resolution, resolution_detail,
                      refund_amount, resolved_by, resolved_at, created_at, updated_at,
                      COUNT(*) OVER() as total_count
               FROM disputes
               WHERE status = $1
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3"#,
        )
        .bind(status_filter)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    };

    let total = disputes.first().and_then(|d| d.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": disputes,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

pub async fn admin_get_dispute(
    State(state): State<AppState>,
    Path(dispute_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-22: Use shared dispute query helpers
    let dispute = crate::domain::dispute::find_dispute_by_id(&state.db, dispute_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Dispute not found".into()))?;

    let messages = crate::domain::dispute::find_dispute_messages(&state.db, dispute_id).await?;

    Ok(Json(json!({
        "data": { "dispute": dispute, "messages": messages }
    })))
}

pub async fn admin_resolve_dispute(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(dispute_id): Path<Uuid>,
    Json(req): Json<crate::domain::dispute::DisputeResolveRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    if crate::domain::dispute::DisputeResolution::from_str(&req.resolution).is_none() {
        return Err(AppError::Validation {
            message: "Invalid resolution. Must be one of: buyer_win, seller_win, partial_refund, mutual_agreement".into(),
            field: Some("resolution".into()),
        });
    }

    // NB-3 FIX: Move dispute fetch inside transaction with FOR UPDATE to prevent concurrent resolution
    let mut tx = state.db.begin().await?;

    let dispute = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String)>(
        "SELECT order_id, buyer_id, seller_id, status FROM disputes WHERE id = $1 FOR UPDATE",
    )
    .bind(dispute_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Dispute not found".into()))?;

    let (order_id, buyer_id, seller_id, status) = dispute;

    if status == "resolved" || status == "closed" {
        return Err(AppError::Conflict(
            "Dispute is already resolved or closed".into(),
        ));
    }

    // Fetch order's previous status for stock restoration decision
    let order_row = sqlx::query_as::<_, (bigdecimal::BigDecimal, String)>(
        "SELECT total_amount, status FROM orders WHERE id = $1",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await?;

    sqlx::query(
        r#"UPDATE disputes SET
           status = 'resolved', resolution = $2, resolution_detail = $3,
           refund_amount = $4, resolved_by = $5, resolved_at = NOW(), updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(dispute_id)
    .bind(&req.resolution)
    .bind(&req.resolution_detail)
    .bind(&req.refund_amount)
    .bind(auth.id)
    .execute(&mut *tx)
    .await?;

    // F3-4 FIX: seller_win → 'confirmed' (not 'delivered') to prevent auto-confirm re-firing
    let new_order_status = match req.resolution.as_str() {
        "buyer_win" | "partial_refund" => "refunded",
        _ => "confirmed",
    };

    sqlx::query("UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1")
        .bind(order_id)
        .bind(new_order_status)
        .execute(&mut *tx)
        .await?;

    // M-3: Add settlement + stock restoration for buyer_win/partial_refund
    if req.resolution == "buyer_win" || req.resolution == "partial_refund" {
        if let Some((order_amount, prev_status)) = order_row {
            // F3-2 FIX: Use req.refund_amount when provided (partial_refund), else full order amount (buyer_win)
            let settlement_amount = req.refund_amount.clone().unwrap_or(order_amount);

            sqlx::query(
                r#"INSERT INTO settlements (id, seller_id, order_id, type, amount, net_amount, status)
                   VALUES ($1, $2, $3, 'refund', $4, $4, 'completed')"#,
            )
            .bind(uuid::Uuid::new_v4())
            .bind(seller_id)
            .bind(order_id)
            .bind(&settlement_amount)
            .execute(&mut *tx)
            .await?;

            // Only restore stock for buyer_win (full refund = order cancelled)
            if req.resolution == "buyer_win" && prev_status == "payment_verified" {
                crate::api::orders::restore_stock_tx(&mut tx, order_id).await?;
            }
        }
    }

    tx.commit().await?;

    // FR-05: buyer_win/partial_refund 시 UDG 취소 이벤트 발송.
    // 그 외 (seller_win, mutual_agreement) 는 위에서 orders.status='confirmed' 로 변경되므로
    // udg 분배 트리거를 위해 order.confirmed 이벤트도 enqueue + 즉시 dispatch.
    // 이전엔 이 분기가 없어 분쟁 해결로 confirmed 된 주문의 분배가 영원히 안 됐음.
    if req.resolution == "buyer_win" || req.resolution == "partial_refund" {
        if let Err(e) =
            crate::domain::udg::enqueue_udg_order_cancelled(&state.db, order_id, &req.resolution)
                .await
        {
            tracing::error!("Failed to enqueue UDG cancel for order {}: {}", order_id, e);
        }
    } else if let Err(e) =
        crate::domain::udg::enqueue_udg_order_confirmed(&state.db, order_id).await
    {
        tracing::error!(
            "Failed to enqueue UDG order.confirmed for dispute-resolved order {}: {}",
            order_id,
            e
        );
    } else {
        let state_bg = state.clone();
        tokio::spawn(async move {
            if let Err(e) = crate::scheduler::webhook::process_webhook_queue(&state_bg).await {
                tracing::warn!(
                    "Immediate webhook dispatch (dispute-resolved order.confirmed) failed, scheduler will retry: {}",
                    e
                );
            }
        });
    }

    // FR-20: 분쟁 해결 시 채팅방 자동 아카이브
    let _ = sqlx::query(
        "UPDATE chat_rooms SET status = 'archived' WHERE order_id = $1 AND status = 'active'",
    )
    .bind(order_id)
    .execute(&state.db)
    .await;

    let resolution_msg = match req.resolution.as_str() {
        "buyer_win" => "Dispute resolved in buyer's favor. Full refund issued.",
        "seller_win" => "Dispute resolved in seller's favor. Order confirmed.",
        "partial_refund" => "Dispute resolved with partial refund.",
        "mutual_agreement" => "Dispute resolved by mutual agreement.",
        _ => "Dispute has been resolved.",
    };

    // seller_id references seller_profiles(id), look up user_id for notifications
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or(seller_id);

    let _ = create_notification(
        &state.db,
        Some(&state.ws_hub),
        buyer_id,
        "dispute",
        "Dispute resolved",
        resolution_msg,
        Some(&format!("/disputes/{}", dispute_id)),
    )
    .await;
    let _ = create_notification(
        &state.db,
        Some(&state.ws_hub),
        seller_user_id,
        "dispute",
        "Dispute resolved",
        resolution_msg,
        Some(&format!("/disputes/{}", dispute_id)),
    )
    .await;

    let dispute_email = crate::domain::email::EmailTemplate::DisputeUpdate {
        dispute_id: dispute_id.to_string(),
        status: "resolved".to_string(),
        message: resolution_msg.to_string(),
    };
    let _ = crate::domain::email::queue_email(&state.db, buyer_id, dispute_email.clone()).await;
    let _ = crate::domain::email::queue_email(&state.db, seller_user_id, dispute_email).await;

    log_admin_action(
        &state.db,
        auth.id,
        "dispute_resolve",
        "dispute",
        dispute_id,
        Some(json!({
            "resolution": req.resolution,
            "resolution_detail": req.resolution_detail,
            "refund_amount": req.refund_amount,
            "new_order_status": new_order_status,
        })),
        ip,
    )
    .await?;

    Ok(Json(json!({
        "data": {
            "id": dispute_id,
            "status": "resolved",
            "resolution": req.resolution,
            "order_status": new_order_status,
        }
    })))
}

// --- Refund Admin ---

pub async fn admin_list_refunds(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("");

    let query = if status_filter.is_empty() || status_filter == "all" {
        format!(
            "SELECT {} {} ORDER BY rr.created_at DESC LIMIT $1 OFFSET $2",
            crate::domain::refund::REFUND_WITH_INFO_SELECT,
            crate::domain::refund::REFUND_WITH_INFO_JOIN,
        )
    } else {
        format!(
            "SELECT {} {} WHERE rr.status = $3 ORDER BY rr.created_at DESC LIMIT $1 OFFSET $2",
            crate::domain::refund::REFUND_WITH_INFO_SELECT,
            crate::domain::refund::REFUND_WITH_INFO_JOIN,
        )
    };

    let refunds = if status_filter.is_empty() || status_filter == "all" {
        sqlx::query_as::<_, crate::domain::refund::RefundRequestWithInfo>(&query)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await?
    } else {
        sqlx::query_as::<_, crate::domain::refund::RefundRequestWithInfo>(&query)
            .bind(per_page)
            .bind(offset)
            .bind(status_filter)
            .fetch_all(&state.db)
            .await?
    };

    let total = refunds.first().and_then(|r| r.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": refunds,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

pub async fn admin_refund_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>, Option<i64>, Option<i64>, Option<i64>, Option<BigDecimal>)>(
        r#"SELECT
            (SELECT COUNT(*) FROM refund_requests),
            (SELECT COUNT(*) FROM refund_requests WHERE status = 'requested'),
            (SELECT COUNT(*) FROM refund_requests WHERE status = 'seller_approved'),
            (SELECT COUNT(*) FROM refund_requests WHERE status IN ('seller_approved', 'admin_processing')),
            (SELECT COUNT(*) FROM refund_requests WHERE status = 'admin_completed'),
            (SELECT COUNT(*) FROM refund_requests WHERE status IN ('seller_rejected', 'admin_rejected')),
            (SELECT COALESCE(SUM(refund_amount), 0) FROM refund_requests WHERE status = 'admin_completed')
        "#,
    )
    .fetch_one(&state.db)
    .await?;

    let result = crate::domain::refund::RefundStats {
        total_requested: stats.0.unwrap_or(0),
        pending_seller: stats.1.unwrap_or(0),
        seller_approved: stats.2.unwrap_or(0),
        admin_pending: stats.3.unwrap_or(0),
        completed: stats.4.unwrap_or(0),
        rejected: stats.5.unwrap_or(0),
        total_refunded_amount: stats.6.unwrap_or_else(|| BigDecimal::from(0)),
    };

    Ok(Json(json!({ "data": result })))
}

pub async fn admin_process_refund(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(refund_id): Path<Uuid>,
    Json(req): Json<crate::domain::refund::AdminRefundProcess>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    if req.action != "approve" && req.action != "reject" {
        return Err(AppError::Validation {
            message: "action must be 'approve' or 'reject'".into(),
            field: Some("action".into()),
        });
    }

    // NB-3 FIX: Move refund fetch inside transaction with FOR UPDATE
    let mut tx = state.db.begin().await?;

    let refund = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String)>(
        "SELECT order_id, buyer_id, seller_id, status FROM refund_requests WHERE id = $1 FOR UPDATE",
    )
    .bind(refund_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Refund request not found".into()))?;

    let (order_id, buyer_id, seller_id, status) = refund;

    if status != "seller_approved" && status != "admin_processing" {
        return Err(AppError::Validation {
            message: "Refund must be in 'seller_approved' or 'admin_processing' status to process"
                .into(),
            field: Some("status".into()),
        });
    }

    let order_number =
        sqlx::query_scalar::<_, String>("SELECT order_number FROM orders WHERE id = $1")
            .bind(order_id)
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or_default();

    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_id)
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(seller_id);

    match req.action.as_str() {
        "approve" => {
            // Determine refund amount
            let order_total = sqlx::query_scalar::<_, BigDecimal>(
                "SELECT total_amount FROM orders WHERE id = $1",
            )
            .bind(order_id)
            .fetch_one(&mut *tx)
            .await?;

            let refund_type = req.refund_type.as_deref().unwrap_or("full");
            let refund_amount = if refund_type == "partial" {
                let amt = req
                    .refund_amount
                    .clone()
                    .ok_or_else(|| AppError::Validation {
                        message: "refund_amount is required for partial refund".into(),
                        field: Some("refund_amount".into()),
                    })?;
                if amt <= 0 || amt > order_total {
                    return Err(AppError::Validation {
                        message: "Refund amount must be between 0 and order total".into(),
                        field: Some("refund_amount".into()),
                    });
                }
                amt
            } else {
                order_total.clone()
            };

            // 1. Update refund request
            sqlx::query(
                r#"UPDATE refund_requests SET
                    status = 'admin_completed',
                    refund_type = $1,
                    refund_amount = $2,
                    admin_note = $3,
                    processed_by = $4,
                    processed_at = NOW(),
                    updated_at = NOW()
                   WHERE id = $5"#,
            )
            .bind(refund_type)
            .bind(&refund_amount)
            .bind(&req.note)
            .bind(auth.id)
            .bind(refund_id)
            .execute(&mut *tx)
            .await?;

            // 2. Get current order status for stock restore decision
            let current_order_status =
                sqlx::query_scalar::<_, String>("SELECT status::TEXT FROM orders WHERE id = $1")
                    .bind(order_id)
                    .fetch_one(&mut *tx)
                    .await?;

            // 3. Update order status to refunded
            sqlx::query("UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = $1")
                .bind(order_id)
                .execute(&mut *tx)
                .await?;

            // 3a. Double-entry ledger: book a negative reversal so historical period SUMs
            // stay immutable (past-month commission already recognized as company income
            // gets a matching refund_reversal row in the current period rather than
            // silently changing the prior period's totals).
            //
            // Partial refunds reverse commission proportionally to the refunded amount.
            // Idempotent on (order_id, entry_type='refund_reversal').
            // Round 6a (C3): order_commission_logs.seller_id 가 user_id 가 아닌
            // seller_profiles(id) 를 참조하도록 표준화됨 (migration 044). 따라서
            // INSERT 시에도 sp.id (seller_profile_id) 를 직접 사용.
            sqlx::query(
                r#"INSERT INTO order_commission_logs
                       (order_id, seller_id, entry_type,
                        order_amount, commission_rate, commission_amount, net_amount)
                   SELECT o.id,
                          sp.id,
                          'refund_reversal',
                          -$2,                                                                    -- order_amount = -refund_amount
                          COALESCE(o.commission_rate, 0),
                          -(COALESCE(o.commission_amount, 0) * $2 / NULLIF(o.total_amount, 0)),   -- proportional commission reversal
                          -($2 - (COALESCE(o.commission_amount, 0) * $2 / NULLIF(o.total_amount, 0)))  -- net = -(refund - reversed_commission)
                   FROM orders o
                   JOIN seller_profiles sp ON sp.id = o.seller_id
                   WHERE o.id = $1
                     AND NOT EXISTS (
                         SELECT 1 FROM order_commission_logs
                         WHERE order_id = $1 AND entry_type = 'refund_reversal'
                     )"#,
            )
            .bind(order_id)
            .bind(&refund_amount)
            .execute(&mut *tx)
            .await?;

            // 4. Restore stock if order was in payment_verified status
            if current_order_status == "payment_verified" {
                crate::api::orders::restore_stock_tx(&mut tx, order_id).await?;
            }

            // 5. Create settlement record (negative amount for refund deduction)
            sqlx::query(
                r#"INSERT INTO settlements (order_id, seller_id, type, amount, status, created_at)
                   VALUES ($1, $2, 'refund', -$3, 'completed', NOW())"#,
            )
            .bind(order_id)
            .bind(seller_id)
            .bind(&refund_amount)
            .execute(&mut *tx)
            .await?;

            // Round 4 (M4): balance 캐시 컬럼 deprecated. read 시 매번 재계산.


            tx.commit().await?;

            // 7. Notify buyer + seller
            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                buyer_id,
                "refund",
                "환불 완료",
                &format!(
                    "주문 #{}의 환불이 완료되었습니다. 환불 금액: ${}",
                    order_number, refund_amount
                ),
                Some(&format!("/refunds/{}", refund_id)),
            )
            .await;

            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                seller_user_id,
                "refund",
                "환불 처리 완료",
                &format!(
                    "주문 #{}의 환불이 처리되었습니다. (${} 차감)",
                    order_number, refund_amount
                ),
                Some("/seller/settlement"),
            )
            .await;

            // 8. Log admin action
            log_admin_action(
                &state.db,
                auth.id,
                "refund_approve",
                "refund",
                refund_id,
                Some(json!({
                    "refund_type": refund_type,
                    "refund_amount": refund_amount.to_string(),
                    "order_id": order_id,
                })),
                ip,
            )
            .await?;

            Ok(Json(json!({
                "data": {
                    "id": refund_id,
                    "status": "admin_completed",
                    "refund_type": refund_type,
                    "refund_amount": refund_amount,
                }
            })))
        }
        "reject" => {
            let note = req.note.as_deref().unwrap_or("관리자 거절");

            sqlx::query(
                r#"UPDATE refund_requests SET
                    status = 'admin_rejected',
                    admin_note = $1,
                    processed_by = $2,
                    processed_at = NOW(),
                    updated_at = NOW()
                   WHERE id = $3"#,
            )
            .bind(note)
            .bind(auth.id)
            .bind(refund_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;

            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                buyer_id,
                "refund",
                "환불 거절",
                &format!(
                    "주문 #{}의 환불이 관리자에 의해 거절되었습니다.",
                    order_number
                ),
                Some(&format!("/refunds/{}", refund_id)),
            )
            .await;

            log_admin_action(
                &state.db,
                auth.id,
                "refund_reject",
                "refund",
                refund_id,
                Some(json!({ "note": note, "order_id": order_id })),
                ip,
            )
            .await?;

            Ok(Json(json!({
                "data": {
                    "id": refund_id,
                    "status": "admin_rejected",
                    "admin_note": note,
                }
            })))
        }
        _ => unreachable!(),
    }
}

// --- Admin Order Management ---

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct AdminOrderInfo {
    pub id: Uuid,
    pub order_number: String,
    pub status: String,
    pub total_amount: bigdecimal::BigDecimal,
    pub subtotal: bigdecimal::BigDecimal,
    pub shipping_fee: bigdecimal::BigDecimal,
    pub margin_amount: bigdecimal::BigDecimal,
    pub courier_name: Option<String>,
    pub tracking_number: Option<String>,
    pub shipped_at: Option<chrono::DateTime<chrono::Utc>>,
    pub delivered_at: Option<chrono::DateTime<chrono::Utc>>,
    pub confirmed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub cancelled_at: Option<chrono::DateTime<chrono::Utc>>,
    pub cancel_reason: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub buyer_email: Option<String>,
    pub buyer_name: Option<String>,
    pub seller_name: Option<String>,
    pub total_count: Option<i64>,
}

pub async fn admin_list_orders(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("%");
    let search = params.q.as_deref().unwrap_or("");
    let search_pattern = search_pattern(search);

    let orders = sqlx::query_as::<_, AdminOrderInfo>(
        r#"SELECT o.id, o.order_number, o.status, o.total_amount, o.subtotal,
                  o.shipping_fee, o.margin_amount,
                  o.courier_name, o.tracking_number,
                  o.shipped_at, o.delivered_at, o.confirmed_at, o.cancelled_at, o.cancel_reason,
                  o.created_at,
                  bu.email as buyer_email, bu.real_name as buyer_name,
                  su.real_name as seller_name,
                  COUNT(*) OVER() as total_count
           FROM orders o
           JOIN users bu ON bu.id = o.buyer_id
           LEFT JOIN seller_profiles sp ON sp.id = o.seller_id
           LEFT JOIN users su ON su.id = sp.user_id
           WHERE o.status LIKE $1
             AND (o.order_number ILIKE $4 OR bu.real_name ILIKE $4 OR bu.email ILIKE $4 OR COALESCE(su.real_name, '') ILIKE $4)
           ORDER BY o.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(status_filter).bind(per_page).bind(offset).bind(&search_pattern)
    .fetch_all(&state.db).await?;

    let total = orders.first().and_then(|o| o.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": orders,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

pub async fn admin_order_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let row = sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64, i64, i64)>(
        r#"SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'pending_payment') as pending_payment,
            COUNT(*) FILTER (WHERE status = 'verifying') as pending_txid,
            COUNT(*) FILTER (WHERE status = 'payment_verified') as payment_verified,
            COUNT(*) FILTER (WHERE status = 'shipped') as shipped,
            COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
            COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
           FROM orders"#,
    )
    .fetch_one(&state.db)
    .await?;

    let total_revenue = sqlx::query_scalar::<_, Option<bigdecimal::BigDecimal>>(
        "SELECT SUM(total_amount) FROM orders WHERE status NOT IN ('cancelled', 'pending_payment')",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "data": {
            "total": row.0,
            "pending_payment": row.1,
            "pending_txid": row.2,
            "payment_verified": row.3,
            "shipped": row.4,
            "delivered": row.5,
            "confirmed": row.6,
            "cancelled": row.7,
            "total_revenue": total_revenue.map(|v| v.to_string()).unwrap_or_else(|| "0".to_string())
        }
    })))
}

pub async fn admin_get_order(
    State(state): State<AppState>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let order = sqlx::query_as::<_, AdminOrderInfo>(
        r#"SELECT o.id, o.order_number, o.status, o.total_amount, o.subtotal,
                  o.shipping_fee, o.margin_amount,
                  o.courier_name, o.tracking_number,
                  o.shipped_at, o.delivered_at, o.confirmed_at, o.cancelled_at, o.cancel_reason,
                  o.created_at,
                  bu.email as buyer_email, bu.real_name as buyer_name,
                  su.real_name as seller_name,
                  NULL::BIGINT as total_count
           FROM orders o
           JOIN users bu ON bu.id = o.buyer_id
           LEFT JOIN seller_profiles sp ON sp.id = o.seller_id
           LEFT JOIN users su ON su.id = sp.user_id
           WHERE o.id = $1"#,
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    // Order items
    let items = sqlx::query_as::<
        _,
        (
            String,
            Option<String>,
            bigdecimal::BigDecimal,
            i32,
            bigdecimal::BigDecimal,
        ),
    >(
        r#"SELECT oi.product_title, oi.option_label, oi.unit_price, oi.quantity, oi.subtotal
           FROM order_items oi WHERE oi.order_id = $1"#,
    )
    .bind(order_id)
    .fetch_all(&state.db)
    .await?;

    let items_json: Vec<serde_json::Value> = items
        .iter()
        .map(|i| {
            json!({
                "product_title": i.0,
                "option_label": i.1,
                "unit_price": i.2.to_string(),
                "quantity": i.3,
                "subtotal": i.4.to_string(),
            })
        })
        .collect();

    Ok(Json(json!({
        "data": {
            "order": order,
            "items": items_json,
        }
    })))
}

// --- UDG Event Management (FR-07) ---

pub async fn admin_list_udg_events(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("");

    let (events, total) = if status_filter.is_empty() {
        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                String,
                serde_json::Value,
                String,
                i32,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<i32>,
                Option<Uuid>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"SELECT id, event_type, payload, status, attempts, last_attempt_at,
                      response_status, order_id, created_at
               FROM webhook_events
               WHERE event_type LIKE 'order.%'
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM webhook_events WHERE event_type LIKE 'order.%'",
        )
        .fetch_one(&state.db)
        .await?;

        (rows, total)
    } else {
        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                String,
                serde_json::Value,
                String,
                i32,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<i32>,
                Option<Uuid>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"SELECT id, event_type, payload, status, attempts, last_attempt_at,
                      response_status, order_id, created_at
               FROM webhook_events
               WHERE event_type LIKE 'order.%' AND status = $3
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(per_page)
        .bind(offset)
        .bind(status_filter)
        .fetch_all(&state.db)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM webhook_events WHERE event_type LIKE 'order.%' AND status = $1",
        )
        .bind(status_filter)
        .fetch_one(&state.db)
        .await?;

        (rows, total)
    };

    let events_json: Vec<serde_json::Value> = events
        .iter()
        .map(|e| {
            json!({
                "id": e.0,
                "event_type": e.1,
                "payload": e.2,
                "status": e.3,
                "attempts": e.4,
                "last_attempt_at": e.5,
                "response_status": e.6,
                "order_id": e.7,
                "created_at": e.8,
            })
        })
        .collect();

    Ok(Json(json!({
        "data": events_json,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

pub async fn admin_udg_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        r#"SELECT
            COUNT(*) FILTER (WHERE event_type LIKE 'order.%') as total,
            COUNT(*) FILTER (WHERE event_type LIKE 'order.%' AND status = 'sent') as sent,
            COUNT(*) FILTER (WHERE event_type LIKE 'order.%' AND status = 'failed') as failed,
            COUNT(*) FILTER (WHERE event_type LIKE 'order.%' AND status = 'dlq') as dlq
           FROM webhook_events"#,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "data": {
            "total": stats.0,
            "sent": stats.1,
            "failed": stats.2,
            "dlq": stats.3,
            "success_rate": if stats.0 > 0 {
                format!("{:.1}%", (stats.1 as f64 / stats.0 as f64) * 100.0)
            } else {
                "N/A".to_string()
            }
        }
    })))
}

// --- v1.2.x: 주문 목록 Excel 내보내기 ---
//
// GET /api/admin/orders/export?status=&q=
// AdminOrdersPage 의 검색/필터와 동일한 파라미터를 사용하여 결과를 XLSX 로 반환.
// 컬럼: 주문번호 / 주문일 / 이메일 / 닉네임 / 전화번호 / 상품명 / 주문수량 / 상품금액 / 총결제금액
// 주문에 상품이 여러 개면 row 가 상품 단위로 분리됨.
pub async fn admin_export_orders(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<(axum::http::StatusCode, axum::http::HeaderMap, Vec<u8>), AppError> {
    use rust_xlsxwriter::*;

    let status_filter = params.status.as_deref().unwrap_or("%");
    let search = params.q.as_deref().unwrap_or("");
    let search_pattern = search_pattern(search);

    #[derive(sqlx::FromRow)]
    struct ExportRow {
        order_number: String,
        created_at: Option<chrono::DateTime<chrono::Utc>>,
        buyer_email: String,
        buyer_nickname: Option<String>,
        buyer_phone: Option<String>,
        product_title: Option<String>,
        quantity: Option<i32>,
        unit_price: Option<BigDecimal>,
        total_amount: BigDecimal,
    }

    let rows = sqlx::query_as::<_, ExportRow>(
        r#"SELECT o.order_number,
                  o.created_at,
                  bu.email AS buyer_email,
                  bu.nickname AS buyer_nickname,
                  bu.phone AS buyer_phone,
                  oi.product_title,
                  oi.quantity,
                  oi.unit_price,
                  o.total_amount
           FROM orders o
           JOIN users bu ON bu.id = o.buyer_id
           LEFT JOIN order_items oi ON oi.order_id = o.id
           LEFT JOIN seller_profiles sp ON sp.id = o.seller_id
           LEFT JOIN users su ON su.id = sp.user_id
           WHERE o.status LIKE $1
             AND (o.order_number ILIKE $2 OR bu.real_name ILIKE $2 OR bu.email ILIKE $2 OR COALESCE(su.real_name, '') ILIKE $2)
           ORDER BY o.created_at DESC, o.id, oi.id"#,
    )
    .bind(status_filter)
    .bind(&search_pattern)
    .fetch_all(&state.db)
    .await?;

    let mut workbook = Workbook::new();
    let ws = workbook.add_worksheet();
    let _ = ws.set_name("주문 목록");

    let header_format = Format::new().set_bold().set_background_color(0xE0E0E0);
    let headers = [
        "주문번호",
        "주문일",
        "이메일",
        "닉네임",
        "전화번호",
        "상품명",
        "주문수량",
        "상품금액",
        "총결제금액",
    ];
    for (c, h) in headers.iter().enumerate() {
        let _ = ws.write_string_with_format(0, c as u16, *h, &header_format);
    }

    // 컬럼 너비
    let widths: [(u16, f64); 9] = [
        (0, 22.0), // 주문번호
        (1, 18.0), // 주문일
        (2, 28.0), // 이메일
        (3, 14.0), // 닉네임
        (4, 16.0), // 전화번호
        (5, 32.0), // 상품명
        (6, 8.0),  // 주문수량
        (7, 14.0), // 상품금액
        (8, 14.0), // 총결제금액
    ];
    for (col, w) in widths {
        let _ = ws.set_column_width(col, w);
    }

    let kst = chrono::FixedOffset::east_opt(9 * 3600).unwrap();

    for (r_idx, row) in rows.iter().enumerate() {
        let r = (r_idx + 1) as u32;
        let created_kst = row
            .created_at
            .map(|t| t.with_timezone(&kst).format("%Y-%m-%d %H:%M").to_string())
            .unwrap_or_default();

        let _ = ws.write_string(r, 0, &row.order_number);
        let _ = ws.write_string(r, 1, &created_kst);
        let _ = ws.write_string(r, 2, &row.buyer_email);
        let _ = ws.write_string(r, 3, row.buyer_nickname.as_deref().unwrap_or(""));
        let _ = ws.write_string(r, 4, row.buyer_phone.as_deref().unwrap_or(""));
        let _ = ws.write_string(r, 5, row.product_title.as_deref().unwrap_or(""));
        if let Some(q) = row.quantity {
            let _ = ws.write_number(r, 6, q as f64);
        }
        if let Some(ref p) = row.unit_price {
            let _ = ws.write_string(r, 7, p.to_string());
        }
        let _ = ws.write_string(r, 8, row.total_amount.to_string());
    }

    let buf = workbook
        .save_to_buffer()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("xlsx generation failed: {e}")))?;

    let now = chrono::Utc::now().with_timezone(&kst).format("%Y%m%d_%H%M");
    let mut headers_map = axum::http::HeaderMap::new();
    headers_map.insert(
        axum::http::header::CONTENT_TYPE,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            .parse()
            .unwrap(),
    );
    headers_map.insert(
        axum::http::header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"orders_{}.xlsx\"", now)
            .parse()
            .unwrap(),
    );

    Ok((axum::http::StatusCode::OK, headers_map, buf))
}
