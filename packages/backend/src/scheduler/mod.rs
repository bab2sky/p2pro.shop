use std::time::Duration;
use tokio::time;
use uuid::Uuid;

use crate::AppState;

pub mod webhook;

/// Run a scheduler task with Sentry error reporting.
async fn run_with_sentry_cron<F, Fut>(slug: &str, f: F)
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<()>>,
{
    let result = f().await;
    if let Err(e) = result {
        tracing::error!("Scheduler error ({}): {:?}", slug, e);
        sentry::capture_error(&*e);
    }
}

pub async fn start_scheduler(state: AppState) {
    tracing::info!("Scheduler started (auto-cancel 5min, webhook 1min, grade 24h, account-cleanup 1h, auto-verify 5min, email 5sec, delivery 30min, coupon-expiry 1h, auto-confirm 1h, refund-auto-approve 1h, failed-txid 10min)");

    let mut cancel_interval = time::interval(Duration::from_secs(300)); // 5 min
    let mut webhook_interval = time::interval(Duration::from_secs(60)); // 1 min
    let mut grade_interval = time::interval(Duration::from_secs(86400)); // 24 hours
    let mut cleanup_interval = time::interval(Duration::from_secs(3600)); // 1 hour
    let mut auto_verify_interval = time::interval(Duration::from_secs(300)); // 5 min
    let mut email_interval = time::interval(Duration::from_secs(5)); // 5 sec (회원가입 인증코드 등 즉시 발송 필요)
    let mut delivery_interval = time::interval(Duration::from_secs(1800)); // 30 min
    let mut coupon_expiry_interval = time::interval(Duration::from_secs(3600)); // 1 hour
    let mut auto_confirm_interval = time::interval(Duration::from_secs(3600)); // 1 hour (FR-02)
    let mut refund_auto_approve_interval = time::interval(Duration::from_secs(3600)); // 1 hour
    let mut failed_txid_interval = time::interval(Duration::from_secs(600)); // 10 min

    loop {
        tokio::select! {
            _ = cancel_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("cancel-expired-orders", || cancel_expired_orders(&s)).await;
            }
            _ = webhook_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("process-webhook-queue", || webhook::process_webhook_queue(&s)).await;
            }
            _ = grade_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("calculate-seller-grades", || calculate_seller_grades(&s)).await;
            }
            _ = cleanup_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("cleanup-deactivated-accounts", || cleanup_deactivated_accounts(&s)).await;
            }
            _ = auto_verify_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("auto-verify-txids", || auto_verify_pending_txids(&s)).await;
            }
            _ = email_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("process-email-queue", || process_email_queue(&s)).await;
            }
            _ = delivery_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("check-delivery-status", || check_delivery_status(&s)).await;
            }
            _ = coupon_expiry_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("expire-coupons", || expire_coupons(&s)).await;
            }
            _ = auto_confirm_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("auto-confirm-delivered", || auto_confirm_delivered_orders(&s)).await;
            }
            _ = refund_auto_approve_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("refund-auto-approve", || auto_approve_refunds(&s)).await;
            }
            _ = failed_txid_interval.tick() => {
                let s = state.clone();
                run_with_sentry_cron("handle-failed-txid", || handle_failed_txid_orders(&s)).await;
            }
        }
    }
}

async fn cancel_expired_orders(state: &AppState) -> anyhow::Result<()> {
    let hours = state.config.txid_auto_cancel_hours;

    // CRIT-05: Use transaction to prevent race condition between SELECT and UPDATE
    let mut tx = state.db.begin().await?;

    // Fetch + lock the orders that are about to be cancelled
    let expired_orders = sqlx::query_as::<_, (Uuid, Uuid)>(
        r#"SELECT id, buyer_id FROM orders
           WHERE status = 'pending_payment'
           AND created_at < NOW() - make_interval(hours => $1::int)
           AND NOT EXISTS (
               SELECT 1 FROM transactions WHERE order_id = orders.id
           )
           FOR UPDATE SKIP LOCKED"#,
    )
    .bind(hours as f64)
    .fetch_all(&mut *tx)
    .await?;

    if expired_orders.is_empty() {
        tx.commit().await?;
        return Ok(());
    }

    // Cancel all expired orders in one UPDATE
    let result = sqlx::query(
        r#"UPDATE orders
           SET status = 'cancelled',
               cancelled_at = NOW(),
               cancel_reason = 'TXID 미입력 자동 취소'
           WHERE status = 'pending_payment'
           AND created_at < NOW() - make_interval(hours => $1::int)
           AND NOT EXISTS (
               SELECT 1 FROM transactions WHERE order_id = orders.id
           )"#,
    )
    .bind(hours as f64)
    .execute(&mut *tx)
    .await?;

    // FR-02: 재고 복원을 취소 트랜잭션 내에서 원자적 처리
    for (order_id, _) in &expired_orders {
        if let Err(e) = crate::api::orders::restore_stock_tx(&mut tx, *order_id).await {
            tracing::error!(
                "Failed to restore stock for cancelled order {}: {:?}",
                order_id,
                e
            );
        }
    }

    tx.commit().await?;

    let affected = result.rows_affected();
    if affected > 0 {
        tracing::info!(
            "Auto-cancelled {} expired orders ({}h timeout)",
            affected,
            hours
        );

        // Send cancellation notification to each affected buyer
        for (order_id, buyer_id) in &expired_orders {
            let _ = crate::domain::notification::create_notification(
                &state.db,
                Some(&state.ws_hub),
                *buyer_id,
                "order",
                "주문 자동 취소",
                &format!(
                    "TXID 미입력으로 인해 주문이 자동 취소되었습니다. ({}시간 초과)",
                    hours
                ),
                Some(&format!("/orders/{}", order_id)),
            )
            .await;

            // FR-20: 주문 취소 시 채팅방 자동 아카이브
            let _ = sqlx::query(
                "UPDATE chat_rooms SET status = 'archived' WHERE order_id = $1 AND status = 'active'"
            )
            .bind(order_id)
            .execute(&state.db)
            .await;
        }
    }

    Ok(())
}

/// FR-02: 7일 이상 delivered 상태인 주문 자동 구매확정
async fn auto_confirm_delivered_orders(state: &AppState) -> anyhow::Result<()> {
    // Use transaction with FOR UPDATE SKIP LOCKED to prevent race conditions
    let mut tx = state.db.begin().await?;

    // Lock rows first to prevent concurrent confirm (manual buyer confirm vs auto-confirm).
    // Audit H1 (2026-05-07): 환불 요청이 진행 중인 (requested/approved) 주문은
    // 자동확정에서 제외. 자동확정 시 UDG 분배가 트리거되고 refund_blocked=TRUE 가
    // 설정되면 환불 요청이 영원히 처리 불가능해지기 때문.
    let to_confirm = sqlx::query_as::<_, (Uuid, Uuid)>(
        r#"SELECT id, buyer_id FROM orders
           WHERE status = 'delivered'
           AND delivered_at IS NOT NULL
           AND delivered_at < NOW() - INTERVAL '7 days'
           AND NOT EXISTS (
               SELECT 1 FROM refund_requests
               WHERE order_id = orders.id
                 AND status IN ('requested', 'approved')
           )
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&mut *tx)
    .await?;

    if to_confirm.is_empty() {
        tx.commit().await?;
        return Ok(());
    }

    let order_ids: Vec<Uuid> = to_confirm.iter().map(|(id, _)| *id).collect();

    // Audit Concurrency C-2 (2026-05-07): refund_blocked 를 자동확정 트랜잭션
    // 안에서 즉시 TRUE 로 설정 (webhook 비동기 처리 사이 race 차단).
    sqlx::query(
        r#"UPDATE orders SET status = 'confirmed', confirmed_at = NOW(), refund_blocked = TRUE, updated_at = NOW()
           WHERE id = ANY($1)"#,
    )
    .bind(&order_ids)
    .execute(&mut *tx)
    .await?;

    // Archive chat rooms in batch
    sqlx::query(
        "UPDATE chat_rooms SET status = 'archived' WHERE order_id = ANY($1) AND status = 'active'",
    )
    .bind(&order_ids)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let confirmed = to_confirm;

    if !confirmed.is_empty() {
        tracing::info!(
            "Auto-confirmed {} delivered orders (7-day timeout)",
            confirmed.len()
        );

        for (order_id, buyer_id) in &confirmed {
            let _ = crate::domain::notification::create_notification(
                &state.db,
                Some(&state.ws_hub),
                *buyer_id,
                "order",
                "자동 구매확정",
                "배송 완료 후 7일이 경과하여 자동 구매확정 처리되었습니다.",
                Some(&format!("/orders/{}", order_id)),
            )
            .await;

            // FR-04: auto_confirm 시 UDG webhook 트리거
            if let Err(e) =
                crate::domain::udg::enqueue_udg_order_confirmed(&state.db, *order_id).await
            {
                tracing::error!("Failed to enqueue UDG event for order {}: {}", order_id, e);
            }

            // FR-20: chat room archiving handled in batch above (within transaction)
        }
    }

    Ok(())
}

/// Batch-calculate seller grades based on sales, ratings, response rate, and dispute rate.
/// M-1: Single aggregated query replaces N+1 pattern (was 7 queries per seller).
async fn calculate_seller_grades(state: &AppState) -> anyhow::Result<()> {
    use crate::domain::seller_grade::{calculate_grade_score, GradeLevel};

    // M-1 FIX: Single query aggregates all metrics for all sellers at once
    let rows = sqlx::query_as::<_, (Uuid, Uuid, i64, Option<f64>, i64, i64)>(
        r#"SELECT
            sp.user_id,
            sp.id AS sp_id,
            COALESCE((SELECT COUNT(*) FROM orders WHERE seller_id = sp.id AND status IN ('delivered', 'confirmed')), 0) AS total_sales,
            (SELECT AVG(r.rating::float8) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.seller_id = sp.id) AS avg_rating,
            COALESCE((SELECT COUNT(*) FROM disputes WHERE seller_id = sp.id), 0) AS total_disputes,
            COALESCE((SELECT COUNT(*) FROM disputes WHERE seller_id = sp.id AND status != 'open'), 0) AS responded_disputes
        FROM seller_profiles sp
        WHERE sp.status = 'approved'"#,
    )
    .fetch_all(&state.db)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    let mut updated = 0u64;

    for (
        _seller_user_id,
        sp_id,
        total_sales_i64,
        avg_rating_opt,
        total_disputes,
        responded_disputes,
    ) in &rows
    {
        let total_sales = *total_sales_i64 as i32;
        let avg_rating = avg_rating_opt.unwrap_or(0.0);

        let response_rate = if *total_disputes > 0 {
            (*responded_disputes as f64 / *total_disputes as f64) * 100.0
        } else {
            100.0
        };

        let dispute_rate = if total_sales > 0 {
            (*total_disputes as f64 / total_sales as f64) * 100.0
        } else {
            0.0
        };

        let score = calculate_grade_score(total_sales, avg_rating, response_rate, dispute_rate);
        let grade = GradeLevel::from_score(score);

        // Round 6b (C3, migration 045): seller_grades.seller_id 가
        // seller_profiles(id) 를 참조하도록 표준화. sp_id 직접 사용 (이전엔 user_id).
        sqlx::query(
            r#"INSERT INTO seller_grades (id, seller_id, grade, score, total_sales, avg_rating, response_rate, dispute_rate, calculated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
               ON CONFLICT (seller_id) DO UPDATE SET
                   grade = EXCLUDED.grade,
                   score = EXCLUDED.score,
                   total_sales = EXCLUDED.total_sales,
                   avg_rating = EXCLUDED.avg_rating,
                   response_rate = EXCLUDED.response_rate,
                   dispute_rate = EXCLUDED.dispute_rate,
                   calculated_at = NOW(),
                   updated_at = NOW()"#,
        )
        .bind(Uuid::new_v4())
        .bind(sp_id)
        .bind(grade.as_str())
        .bind(score)
        .bind(total_sales)
        .bind(avg_rating)
        .bind(response_rate)
        .bind(dispute_rate)
        .execute(&state.db)
        .await?;

        updated += 1;
    }

    if updated > 0 {
        tracing::info!("Seller grades recalculated for {} sellers", updated);
    }

    Ok(())
}

/// Auto-verify pending TXIDs that were submitted but not yet verified
async fn auto_verify_pending_txids(state: &AppState) -> anyhow::Result<()> {
    let pending = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            Uuid,
            bigdecimal::BigDecimal,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        r#"SELECT t.id, t.order_id, t.txid, o.buyer_id, o.total_amount, o.created_at
           FROM transactions t
           JOIN orders o ON o.id = t.order_id
           WHERE t.verification_status = 'pending'
           AND t.submitted_at > NOW() - INTERVAL '24 hours'
           ORDER BY t.submitted_at ASC
           LIMIT 50"#,
    )
    .fetch_all(&state.db)
    .await?;

    if pending.is_empty() {
        return Ok(());
    }

    let verifier = crate::domain::txid_verifier::TxidVerifier::new(
        state.config.etherscan_api_key.clone(),
        state.config.trongrid_api_key.clone(),
        state.config.company_wallet_eth.clone(),
        state.config.company_wallet_tron.clone(),
    );

    let mut verified_count = 0u64;
    let mut failed_count = 0u64;

    for (tx_id, order_id, txid, buyer_id, total_amount, created_at) in &pending {
        let created = created_at.unwrap_or_else(chrono::Utc::now);
        let result = verifier
            .verify_with_retry(txid, total_amount, created, &state.db, 2)
            .await;

        let status = if result.passed { "verified" } else { "failed" };

        // W-2/W-3 FIX: Wrap transaction + order update in DB transaction with status guard
        let mut tx = state.db.begin().await?;

        sqlx::query(
            r#"UPDATE transactions
               SET verification_status = $1, from_address = $2, to_address = $3,
                   amount = $4, failure_reason = $5, verified_at = NOW()
               WHERE id = $6"#,
        )
        .bind(status)
        .bind(&result.from_address)
        .bind(&result.to_address)
        .bind(&result.amount)
        .bind(&result.failure_reason)
        .bind(tx_id)
        .execute(&mut *tx)
        .await?;

        if result.passed {
            // W-3 FIX: Add status guard to prevent overwriting concurrent dispute/cancellation
            sqlx::query("UPDATE orders SET status = 'payment_verified', updated_at = NOW() WHERE id = $1 AND status = 'verifying'")
                .bind(order_id)
                .execute(&mut *tx)
                .await?;

            let _ = crate::domain::notification::create_notification(
                &state.db,
                Some(&state.ws_hub),
                *buyer_id,
                "payment",
                "결제 확인 완료",
                "TXID 자동 검증이 완료되어 결제가 승인되었습니다.",
                Some(&format!("/orders/{}", order_id)),
            )
            .await;

            // Queue email notification
            let order_number =
                sqlx::query_scalar::<_, String>("SELECT order_number FROM orders WHERE id = $1")
                    .bind(order_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_default();

            let _ = crate::domain::email::queue_email(
                &state.db,
                *buyer_id,
                crate::domain::email::EmailTemplate::TxidApproved { order_number },
            )
            .await;

            verified_count += 1;
        } else {
            failed_count += 1;
        }

        // W-2 FIX: Commit transaction after each TXID verification
        tx.commit().await?;

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }

    if verified_count > 0 || failed_count > 0 {
        tracing::info!(
            "Auto-verify batch: {} verified, {} failed out of {} pending",
            verified_count,
            failed_count,
            pending.len()
        );
    }

    Ok(())
}

/// Process pending email queue
async fn process_email_queue(state: &AppState) -> anyhow::Result<()> {
    if state.config.smtp_host.is_empty() {
        return Ok(());
    }

    // C-4: Use transaction with FOR UPDATE SKIP LOCKED to prevent duplicate email sends
    let mut tx = state.db.begin().await?;

    let pending = sqlx::query_as::<_, (Uuid, String, String, String)>(
        r#"SELECT id, email_to, subject, COALESCE(body_html, '')
           FROM email_logs
           WHERE status = 'pending' AND attempts < max_attempts
           ORDER BY created_at ASC
           LIMIT 20
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&mut *tx)
    .await?;

    if pending.is_empty() {
        tx.commit().await?;
        return Ok(());
    }

    // Mark all selected emails as 'sending' within the transaction to claim them
    for (id, _, _, _) in &pending {
        sqlx::query(
            "UPDATE email_logs SET status = 'sending', attempts = attempts + 1 WHERE id = $1",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Now send emails outside the transaction (rows are already claimed with 'sending' status)
    let sender = crate::domain::email::EmailSender::new(
        &state.config.smtp_host,
        state.config.smtp_port,
        &state.config.smtp_username,
        &state.config.smtp_password,
        &state.config.smtp_from_email,
        &state.config.smtp_from_name,
        state.config.smtp_use_tls,
    )?;

    let mut sent = 0u64;

    for (id, email_to, subject, body_html) in &pending {
        match sender.send(email_to, subject, body_html).await {
            Ok(()) => {
                sqlx::query("UPDATE email_logs SET status = 'sent', sent_at = NOW() WHERE id = $1")
                    .bind(id)
                    .execute(&state.db)
                    .await?;
                sent += 1;
            }
            Err(e) => {
                sqlx::query(
                    "UPDATE email_logs SET status = 'pending', error_message = $1 WHERE id = $2",
                )
                .bind(e.to_string())
                .bind(id)
                .execute(&state.db)
                .await?;
                tracing::warn!("Email send failed for {}: {}", id, e);
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }

    if sent > 0 {
        tracing::info!(
            "Processed email queue: {} sent out of {} pending",
            sent,
            pending.len()
        );
    }

    Ok(())
}

/// Check delivery status via SweetTracker API
async fn check_delivery_status(state: &AppState) -> anyhow::Result<()> {
    if state.config.sweettracker_api_key.is_empty() {
        return Ok(());
    }

    let active = sqlx::query_as::<_, (Uuid, Uuid, String, String, Uuid)>(
        r#"SELECT dt.id, dt.order_id, dt.carrier_code, dt.tracking_number, o.buyer_id
           FROM delivery_trackings dt
           JOIN orders o ON o.id = dt.order_id
           WHERE dt.status NOT IN ('delivered', 'exception')
           AND (dt.last_checked_at IS NULL OR dt.last_checked_at < NOW() - INTERVAL '25 minutes')
           ORDER BY dt.last_checked_at ASC NULLS FIRST
           LIMIT 30"#,
    )
    .fetch_all(&state.db)
    .await?;

    if active.is_empty() {
        return Ok(());
    }

    let tracker = crate::domain::delivery::DeliveryTracker::new(
        state.config.sweettracker_api_key.clone(),
        state.config.sweettracker_api_url.clone(),
    );

    for (tracking_id, order_id, carrier_code, tracking_number, buyer_id) in &active {
        match tracker.fetch_tracking(carrier_code, tracking_number).await {
            Ok((events, is_complete)) => {
                let events_json = serde_json::to_value(&events).unwrap_or_default();
                let last_detail = events.first().map(|e| e.description.clone());
                let new_status = if is_complete {
                    "delivered"
                } else {
                    "in_transit"
                };
                let delivered_at = if is_complete {
                    Some(chrono::Utc::now())
                } else {
                    None
                };

                sqlx::query(
                    r#"UPDATE delivery_trackings
                       SET status = $1, last_detail = $2, tracking_events = $3,
                           last_checked_at = NOW(), delivered_at = $4, updated_at = NOW()
                       WHERE id = $5"#,
                )
                .bind(new_status)
                .bind(&last_detail)
                .bind(&events_json)
                .bind(delivered_at)
                .bind(tracking_id)
                .execute(&state.db)
                .await?;

                if is_complete {
                    sqlx::query("UPDATE orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'shipped'")
                        .bind(order_id)
                        .execute(&state.db)
                        .await?;

                    let _ = crate::domain::notification::create_notification(
                        &state.db,
                        Some(&state.ws_hub),
                        *buyer_id,
                        "delivery",
                        "배송 완료",
                        "주문하신 상품의 배송이 완료되었습니다.",
                        Some(&format!("/orders/{}", order_id)),
                    )
                    .await;

                    // Queue delivery complete email
                    let order_number = sqlx::query_scalar::<_, String>(
                        "SELECT order_number FROM orders WHERE id = $1",
                    )
                    .bind(order_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_default();

                    let _ = crate::domain::email::queue_email(
                        &state.db,
                        *buyer_id,
                        crate::domain::email::EmailTemplate::DeliveryComplete {
                            order_number,
                            carrier: carrier_code.clone(),
                            tracking: tracking_number.clone(),
                        },
                    )
                    .await;
                }
            }
            Err(e) => {
                tracing::warn!("Delivery check failed for tracking {}: {}", tracking_id, e);
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }

    Ok(())
}

/// Auto-deactivate expired coupons
async fn expire_coupons(state: &AppState) -> anyhow::Result<()> {
    let result = sqlx::query(
        "UPDATE coupons SET is_active = false, updated_at = NOW() WHERE is_active = true AND expires_at < NOW()",
    )
    .execute(&state.db)
    .await?;

    let affected = result.rows_affected();
    if affected > 0 {
        tracing::info!("Auto-deactivated {} expired coupons", affected);
    }

    Ok(())
}

/// Delete accounts that have been in 'deactivating' status for more than 30 days.
async fn cleanup_deactivated_accounts(state: &AppState) -> anyhow::Result<()> {
    let result = sqlx::query(
        r#"UPDATE users SET
           account_status = 'deleted',
           status = 'deleted',
           updated_at = NOW()
           WHERE account_status = 'deactivating'
           AND deactivation_requested_at < NOW() - INTERVAL '30 days'"#,
    )
    .execute(&state.db)
    .await?;

    let affected = result.rows_affected();
    if affected > 0 {
        tracing::info!(
            "Permanently deleted {} deactivated accounts (30-day grace period expired)",
            affected
        );
    }

    Ok(())
}

/// FR-09: Auto-approve refund requests after 3 days of seller non-response
async fn auto_approve_refunds(state: &AppState) -> anyhow::Result<()> {
    // C-3: Use transaction with FOR UPDATE SKIP LOCKED to prevent race condition
    let mut tx = state.db.begin().await?;

    let expired = sqlx::query_as::<_, (Uuid, Uuid, Uuid)>(
        r#"SELECT id, buyer_id, seller_id FROM refund_requests
           WHERE status = 'requested'
           AND created_at < NOW() - INTERVAL '3 days'
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&mut *tx)
    .await?;

    if expired.is_empty() {
        tx.commit().await?;
        return Ok(());
    }

    for (refund_id, _buyer_id, _seller_id) in &expired {
        sqlx::query(
            r#"UPDATE refund_requests SET
                status = 'seller_approved',
                seller_response = 'auto_approve',
                seller_responded_at = NOW(),
                updated_at = NOW()
               WHERE id = $1 AND status = 'requested'"#,
        )
        .bind(refund_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Send notifications outside transaction
    for (refund_id, buyer_id, _seller_id) in &expired {
        let _ = crate::domain::notification::create_notification(
            &state.db,
            Some(&state.ws_hub),
            *buyer_id,
            "refund",
            "환불 자동 승인",
            "판매자 미응답으로 환불이 자동 승인되었습니다. 관리자 처리를 기다려주세요.",
            Some(&format!("/refunds/{}", refund_id)),
        )
        .await;

        // Notify admins
        let admin_ids =
            sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE role = 'admin' LIMIT 5")
                .fetch_all(&state.db)
                .await
                .unwrap_or_default();

        for admin_id in admin_ids {
            let _ = crate::domain::notification::create_notification(
                &state.db,
                Some(&state.ws_hub),
                admin_id,
                "refund",
                "환불 자동 승인 (판매자 미응답)",
                "판매자 미응답으로 환불 요청이 자동 승인되었습니다. 처리가 필요합니다.",
                Some("/admin/refunds"),
            )
            .await;
        }
    }

    if !expired.is_empty() {
        tracing::info!(
            "Auto-approved {} refund requests (seller 3-day timeout)",
            expired.len()
        );
    }
    Ok(())
}

/// Auto-cancel orders stuck in 'verifying' status with failed TXID verification
/// after 2 hours since the last verification attempt.
async fn handle_failed_txid_orders(state: &AppState) -> anyhow::Result<()> {
    let mut tx = state.db.begin().await?;

    // Find orders in 'verifying' status where the associated transaction has
    // verification_status = 'failed' and the verification was attempted > 2 hours ago
    let failed_orders = sqlx::query_as::<_, (Uuid, Uuid)>(
        r#"SELECT o.id, o.buyer_id FROM orders o
           WHERE o.status = 'verifying'
           AND EXISTS (
               SELECT 1 FROM transactions t
               WHERE t.order_id = o.id
               AND t.verification_status = 'failed'
               AND t.verified_at < NOW() - INTERVAL '2 hours'
           )
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&mut *tx)
    .await?;

    if failed_orders.is_empty() {
        tx.commit().await?;
        return Ok(());
    }

    let order_ids: Vec<Uuid> = failed_orders.iter().map(|(id, _)| *id).collect();

    // Cancel all matched orders in one UPDATE
    sqlx::query(
        r#"UPDATE orders
           SET status = 'cancelled',
               cancelled_at = NOW(),
               cancel_reason = 'TXID 검증 실패 자동 취소',
               updated_at = NOW()
           WHERE id = ANY($1) AND status = 'verifying'"#,
    )
    .bind(&order_ids)
    .execute(&mut *tx)
    .await?;

    // Restore stock for each cancelled order
    for (order_id, _) in &failed_orders {
        if let Err(e) = crate::api::orders::restore_stock_tx(&mut tx, *order_id).await {
            tracing::error!(
                "Failed to restore stock for failed-txid order {}: {:?}",
                order_id,
                e
            );
        }
    }

    // Archive chat rooms in batch
    sqlx::query(
        "UPDATE chat_rooms SET status = 'archived' WHERE order_id = ANY($1) AND status = 'active'",
    )
    .bind(&order_ids)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Send notifications outside transaction
    if !failed_orders.is_empty() {
        tracing::info!(
            "Auto-cancelled {} orders with failed TXID verification (2h timeout)",
            failed_orders.len()
        );

        for (order_id, buyer_id) in &failed_orders {
            let _ = crate::domain::notification::create_notification(
                &state.db,
                Some(&state.ws_hub),
                *buyer_id,
                "order",
                "주문 자동 취소",
                "TXID 검증 실패로 주문이 자동 취소되었습니다",
                Some(&format!("/orders/{}", order_id)),
            )
            .await;
        }
    }

    Ok(())
}
