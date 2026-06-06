//! Product review, TXID verification, seller/user management

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    Extension, Json,
};
use serde_json::json;
use std::net::SocketAddr;
use uuid::Uuid;

use super::{extract_ip, search_pattern};
use crate::domain::admin::*;
use crate::domain::common::Pagination;
use crate::domain::notification::create_notification;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

// --- Product Management (full) ---

/// GET /admin/products — list all products with status filter & search
pub async fn list_admin_products(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<AdminProductListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("");
    let search = params.q.as_deref().unwrap_or("");
    // m-6: Escape LIKE wildcards in user-supplied search input
    let search_pattern = search_pattern(search);

    let order_clause = match params.sort.as_deref() {
        Some("rating_desc") => "COALESCE(p.avg_rating, 0) DESC, p.review_count DESC",
        Some("rating_asc") => "COALESCE(p.avg_rating, 0) ASC",
        Some("review_count_desc") => "COALESCE(p.review_count, 0) DESC",
        Some("review_count_asc") => "COALESCE(p.review_count, 0) ASC",
        Some("price_desc") => "p.final_price DESC",
        Some("price_asc") => "p.final_price ASC",
        Some("sold_desc") => "COALESCE(p.sold_count, 0) DESC",
        Some("stock_asc") => "p.stock ASC",
        Some("created_asc") => "p.created_at ASC",
        _ => "p.created_at DESC",
    };

    let products = if status_filter.is_empty() || status_filter == "all" {
        let query = format!(
            r#"SELECT p.id, p.title,
                      COALESCE(u.nickname, u.real_name, u.username) as seller_name,
                      u.email as seller_email,
                      c.name as category_name,
                      p.base_price, p.margin_rate, p.final_price, p.shipping_fee,
                      p.stock, p.sold_count, p.view_count, p.review_count, p.avg_rating,
                      p.status, p.rejected_reason, p.approved_at,
                      p.created_at, p.updated_at,
                      COUNT(*) OVER() as total_count
               FROM products p
               JOIN seller_profiles sp ON sp.id = p.seller_id
               JOIN users u ON u.id = sp.user_id
               LEFT JOIN categories c ON c.id = p.category_id
               WHERE (p.title ILIKE $1 OR u.username ILIKE $1 OR u.real_name ILIKE $1
                      OR u.nickname ILIKE $1 OR u.email ILIKE $1)
               ORDER BY {}
               LIMIT $2 OFFSET $3"#,
            order_clause
        );
        sqlx::query_as::<_, AdminProduct>(&query)
            .bind(&search_pattern)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await?
    } else {
        let query = format!(
            r#"SELECT p.id, p.title,
                      COALESCE(u.nickname, u.real_name, u.username) as seller_name,
                      u.email as seller_email,
                      c.name as category_name,
                      p.base_price, p.margin_rate, p.final_price, p.shipping_fee,
                      p.stock, p.sold_count, p.view_count, p.review_count, p.avg_rating,
                      p.status, p.rejected_reason, p.approved_at,
                      p.created_at, p.updated_at,
                      COUNT(*) OVER() as total_count
               FROM products p
               JOIN seller_profiles sp ON sp.id = p.seller_id
               JOIN users u ON u.id = sp.user_id
               LEFT JOIN categories c ON c.id = p.category_id
               WHERE p.status = $1
                 AND (p.title ILIKE $2 OR u.username ILIKE $2 OR u.real_name ILIKE $2
                      OR u.nickname ILIKE $2 OR u.email ILIKE $2)
               ORDER BY {}
               LIMIT $3 OFFSET $4"#,
            order_clause
        );
        sqlx::query_as::<_, AdminProduct>(&query)
            .bind(status_filter)
            .bind(&search_pattern)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await?
    };

    let total = products.first().and_then(|p| p.total_count).unwrap_or(0);

    Ok(Json(AdminProductListResponse {
        data: products,
        pagination: Pagination::new(page, per_page, total),
    }))
}

/// GET /admin/products/stats — product statistics
pub async fn product_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query_as::<
        _,
        (
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
        ),
    >(
        r#"SELECT
            (SELECT COUNT(*) FROM products),
            (SELECT COUNT(*) FROM products WHERE status = 'pending'),
            (SELECT COUNT(*) FROM products WHERE status = 'active'),
            (SELECT COUNT(*) FROM products WHERE status = 'rejected'),
            (SELECT COUNT(*) FROM products WHERE status = 'suspended'),
            (SELECT COUNT(*) FROM products WHERE created_at >= CURRENT_DATE),
            (SELECT COUNT(*) FROM products WHERE status = 'active' AND stock = 0),
            (SELECT COALESCE(SUM(sold_count), 0) FROM products WHERE status = 'active')
        "#,
    )
    .fetch_one(&state.db)
    .await?;

    let result = ProductStats {
        total_products: stats.0.unwrap_or(0),
        pending_products: stats.1.unwrap_or(0),
        active_products: stats.2.unwrap_or(0),
        rejected_products: stats.3.unwrap_or(0),
        suspended_products: stats.4.unwrap_or(0),
        today_new: stats.5.unwrap_or(0),
        out_of_stock: stats.6.unwrap_or(0),
        total_sold: stats.7.unwrap_or(0),
    };

    Ok(Json(json!({ "data": result })))
}

/// PUT /admin/products/{id}/suspend — suspend an active product
pub async fn suspend_product(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<ProductStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));
    let reason = req.reason.as_deref().unwrap_or("관리자 정지");

    let result = sqlx::query(
        "UPDATE products SET status = 'suspended', rejected_reason = $1, updated_at = NOW() WHERE id = $2 AND status = 'active'",
    ).bind(reason).bind(id).execute(&state.db).await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Product not found or not active".into()));
    }

    let seller_user_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT sp.user_id FROM products p JOIN seller_profiles sp ON sp.id = p.seller_id WHERE p.id = $1",
    ).bind(id).fetch_optional(&state.db).await?;

    if let Some(uid) = seller_user_id {
        let msg = format!("상품이 정지되었습니다. 사유: {}", reason);
        let _ = create_notification(
            &state.db,
            Some(&state.ws_hub),
            uid,
            "product",
            "상품 정지",
            &msg,
            Some("/seller/products"),
        )
        .await;
    }

    log_admin_action(
        &state.db,
        auth.id,
        "product_suspend",
        "product",
        id,
        Some(json!({ "reason": reason })),
        ip,
    )
    .await?;

    Ok(Json(
        json!({ "data": { "id": id, "status": "suspended", "reason": reason } }),
    ))
}

/// PUT /admin/products/{id}/restore — restore a suspended/rejected product to active
pub async fn restore_product(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let prev_status =
        sqlx::query_scalar::<_, Option<String>>("SELECT status FROM products WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    let result = sqlx::query(
        "UPDATE products SET status = 'active', rejected_reason = NULL, approved_at = NOW(), updated_at = NOW() WHERE id = $1 AND status IN ('suspended', 'rejected')",
    ).bind(id).execute(&state.db).await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Product not found or not in suspended/rejected status".into(),
        ));
    }

    let seller_user_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT sp.user_id FROM products p JOIN seller_profiles sp ON sp.id = p.seller_id WHERE p.id = $1",
    ).bind(id).fetch_optional(&state.db).await?;

    if let Some(uid) = seller_user_id {
        let _ = create_notification(
            &state.db,
            Some(&state.ws_hub),
            uid,
            "product",
            "상품 복원",
            "정지/반려된 상품이 복원되어 다시 판매 가능합니다.",
            Some("/seller/products"),
        )
        .await;
    }

    log_admin_action(
        &state.db,
        auth.id,
        "product_restore",
        "product",
        id,
        Some(json!({ "previous_status": prev_status })),
        ip,
    )
    .await?;

    Ok(Json(json!({ "data": { "id": id, "status": "active" } })))
}

// --- Product Review (legacy pending-only) ---

pub async fn pending_products(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<PendingProductListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    // FR-08: Single query with COUNT(*) OVER()
    let products = sqlx::query_as::<_, PendingProduct>(
        r#"SELECT p.id, p.title,
                  COALESCE(u.nickname, u.username) as seller_name,
                  p.final_price as price, p.status, p.created_at,
                  COUNT(*) OVER() as total_count
           FROM products p
           JOIN seller_profiles sp ON sp.id = p.seller_id
           JOIN users u ON u.id = sp.user_id
           WHERE p.status = 'pending'
           ORDER BY p.created_at ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = products.first().and_then(|p| p.total_count).unwrap_or(0);

    Ok(Json(PendingProductListResponse {
        data: products,
        pagination: Pagination::new(page, per_page, total),
    }))
}

pub async fn approve_product(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query(
        "UPDATE products SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'pending'",
    ).bind(id).execute(&state.db).await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Product not found or not pending".into(),
        ));
    }

    let seller_user_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT sp.user_id FROM products p JOIN seller_profiles sp ON sp.id = p.seller_id WHERE p.id = $1",
    ).bind(id).fetch_optional(&state.db).await?;

    if let Some(uid) = seller_user_id {
        let _ = create_notification(
            &state.db,
            Some(&state.ws_hub),
            uid,
            "product",
            "상품 승인 완료",
            "등록하신 상품이 승인되었습니다.",
            Some("/seller/products"),
        )
        .await;
    }

    log_admin_action(
        &state.db,
        auth.id,
        "product_approve",
        "product",
        id,
        None,
        ip,
    )
    .await?;

    Ok(Json(json!({ "data": { "id": id, "status": "active" } })))
}

pub async fn reject_product(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<RejectRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query(
        "UPDATE products SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status = 'pending'",
    ).bind(id).execute(&state.db).await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Product not found or not pending".into(),
        ));
    }

    let seller_user_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT sp.user_id FROM products p JOIN seller_profiles sp ON sp.id = p.seller_id WHERE p.id = $1",
    ).bind(id).fetch_optional(&state.db).await?;

    if let Some(uid) = seller_user_id {
        let msg = format!("상품이 반려되었습니다. 사유: {}", req.reason);
        let _ = create_notification(
            &state.db,
            Some(&state.ws_hub),
            uid,
            "product",
            "상품 반려",
            &msg,
            Some("/seller/products"),
        )
        .await;
    }

    log_admin_action(
        &state.db,
        auth.id,
        "product_reject",
        "product",
        id,
        Some(json!({ "reason": req.reason })),
        ip,
    )
    .await?;

    Ok(Json(
        json!({ "data": { "id": id, "status": "rejected", "reject_reason": req.reason } }),
    ))
}

// --- TXID Manual Verification ---

pub async fn pending_txids(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<PendingTxidListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    // FR-08: Single query with COUNT(*) OVER()
    let txids = sqlx::query_as::<_, PendingTxid>(
        r#"SELECT t.id, t.order_id, o.order_number, t.txid,
                  COALESCE(u.nickname, u.username) as buyer_name,
                  o.total_amount, t.verification_status, t.failure_reason, t.submitted_at,
                  COUNT(*) OVER() as total_count
           FROM transactions t
           JOIN orders o ON o.id = t.order_id
           JOIN users u ON u.id = o.buyer_id
           WHERE t.verification_status IN ('pending', 'failed')
           ORDER BY t.submitted_at ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = txids.first().and_then(|t| t.total_count).unwrap_or(0);

    Ok(Json(PendingTxidListResponse {
        data: txids,
        pagination: Pagination::new(page, per_page, total),
    }))
}

pub async fn verify_txid(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<TxidVerifyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    // FR-25: 트랜잭션으로 transaction + order 상태 변경 원자적 처리
    let mut db_tx = state.db.begin().await?;

    let txn = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT order_id, txid FROM transactions WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *db_tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Transaction not found".into()))?;

    let (order_id, _txid) = txn;

    match req.action.as_str() {
        "approve" => {
            sqlx::query(
                "UPDATE transactions SET verification_status = 'verified', verified_by = $1, verified_at = NOW() WHERE id = $2",
            ).bind(auth.id).bind(id).execute(&mut *db_tx).await?;

            sqlx::query(
                "UPDATE orders SET status = 'payment_verified', updated_at = NOW() WHERE id = $1",
            )
            .bind(order_id)
            .execute(&mut *db_tx)
            .await?;

            db_tx.commit().await?;

            let buyer_id =
                sqlx::query_scalar::<_, Uuid>("SELECT buyer_id FROM orders WHERE id = $1")
                    .bind(order_id)
                    .fetch_one(&state.db)
                    .await?;

            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                buyer_id,
                "payment",
                "결제 확인 완료",
                "TXID 검증이 완료되어 결제가 승인되었습니다.",
                Some(&format!("/orders/{}", order_id)),
            )
            .await;

            let order_num =
                sqlx::query_scalar::<_, String>("SELECT order_number FROM orders WHERE id = $1")
                    .bind(order_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_default();
            let _ = crate::domain::email::queue_email(
                &state.db,
                buyer_id,
                crate::domain::email::EmailTemplate::TxidApproved {
                    order_number: order_num,
                },
            )
            .await;

            log_admin_action(
                &state.db,
                auth.id,
                "txid_approve",
                "transaction",
                id,
                None,
                ip.clone(),
            )
            .await?;

            Ok(Json(json!({
                "data": {
                    "transaction_id": id,
                    "order_id": order_id,
                    "verification_status": "verified",
                    "verified_by": auth.id
                }
            })))
        }
        "reject" => {
            let reason = req.reason.as_deref().unwrap_or("관리자 거부");

            sqlx::query(
                "UPDATE transactions SET verification_status = 'rejected', failure_reason = $1, verified_by = $2, verified_at = NOW() WHERE id = $3",
            ).bind(reason).bind(auth.id).bind(id).execute(&mut *db_tx).await?;

            sqlx::query(
                "UPDATE orders SET status = 'payment_rejected', updated_at = NOW() WHERE id = $1",
            )
            .bind(order_id)
            .execute(&mut *db_tx)
            .await?;

            db_tx.commit().await?;

            let buyer_id =
                sqlx::query_scalar::<_, Uuid>("SELECT buyer_id FROM orders WHERE id = $1")
                    .bind(order_id)
                    .fetch_one(&state.db)
                    .await?;

            let msg = format!("결제가 거부되었습니다. 사유: {}", reason);
            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                buyer_id,
                "payment",
                "결제 거부",
                &msg,
                Some(&format!("/orders/{}", order_id)),
            )
            .await;

            let order_num =
                sqlx::query_scalar::<_, String>("SELECT order_number FROM orders WHERE id = $1")
                    .bind(order_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_default();
            let _ = crate::domain::email::queue_email(
                &state.db,
                buyer_id,
                crate::domain::email::EmailTemplate::TxidRejected {
                    order_number: order_num,
                    reason: reason.to_string(),
                },
            )
            .await;

            log_admin_action(
                &state.db,
                auth.id,
                "txid_reject",
                "transaction",
                id,
                Some(json!({ "reason": reason })),
                ip,
            )
            .await?;

            Ok(Json(json!({
                "data": {
                    "transaction_id": id,
                    "order_id": order_id,
                    "verification_status": "rejected",
                    "verified_by": auth.id
                }
            })))
        }
        _ => Err(AppError::Validation {
            message: "action must be 'approve' or 'reject'".into(),
            field: Some("action".into()),
        }),
    }
}

// --- Seller Management ---

pub async fn list_sellers(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<SellerListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let status_filter = params.status.as_deref().unwrap_or("");
    let search = params.q.as_deref().unwrap_or("");
    let search_pattern = search_pattern(search);

    let sellers = if status_filter.is_empty() || status_filter == "all" {
        sqlx::query_as::<_, SellerInfo>(
            r#"SELECT sp.id, sp.user_id, sp.seller_type, sp.contact_phone,
                      COALESCE(u.nickname, u.real_name, u.username) as seller_name,
                      u.email,
                      sp.wallet_address, sp.status, sp.balance,
                      sp.total_sales, sp.total_revenue, sp.avg_rating,
                      sp.grade, sp.grade_score, sp.dispute_count,
                      sp.rejected_reason, sp.approved_at, sp.created_at,
                      COUNT(*) OVER() as total_count
               FROM seller_profiles sp
               JOIN users u ON u.id = sp.user_id
               WHERE (u.username ILIKE $1 OR u.real_name ILIKE $1 OR u.email ILIKE $1
                      OR u.nickname ILIKE $1 OR sp.contact_phone ILIKE $1)
               ORDER BY sp.created_at DESC
               LIMIT $2 OFFSET $3"#,
        )
        .bind(&search_pattern)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, SellerInfo>(
            r#"SELECT sp.id, sp.user_id, sp.seller_type, sp.contact_phone,
                      COALESCE(u.nickname, u.real_name, u.username) as seller_name,
                      u.email,
                      sp.wallet_address, sp.status, sp.balance,
                      sp.total_sales, sp.total_revenue, sp.avg_rating,
                      sp.grade, sp.grade_score, sp.dispute_count,
                      sp.rejected_reason, sp.approved_at, sp.created_at,
                      COUNT(*) OVER() as total_count
               FROM seller_profiles sp
               JOIN users u ON u.id = sp.user_id
               WHERE sp.status = $1
                 AND (u.username ILIKE $2 OR u.real_name ILIKE $2 OR u.email ILIKE $2
                      OR u.nickname ILIKE $2 OR sp.contact_phone ILIKE $2)
               ORDER BY sp.created_at DESC
               LIMIT $3 OFFSET $4"#,
        )
        .bind(status_filter)
        .bind(&search_pattern)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    };

    let total = sellers.first().and_then(|s| s.total_count).unwrap_or(0);

    Ok(Json(SellerListResponse {
        data: sellers,
        pagination: Pagination::new(page, per_page, total),
    }))
}

/// GET /admin/sellers/stats — seller statistics
pub async fn seller_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query_as::<
        _,
        (
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<i64>,
            Option<bigdecimal::BigDecimal>,
            Option<bigdecimal::BigDecimal>,
        ),
    >(
        // Round 4 (M4): seller_profiles.balance 는 cached 컬럼이라 stale 가능.
        // 모든 read 흐름이 settlement.rs::compute_settlement_summary 로 매번
        // 재계산하지만 이 한 admin endpoint 만 stale 캐시에 의존. settlement
        // 와 동일 정책으로 통일 — per-seller (sales - commission - withdrawn -
        // refunded) 0 클램핑 후 합산.
        //
        // 매출/출금 status 정책: settlement.rs::calculate_seller_balance 와 동일
        // (delivered/confirmed only, withdrawn 은 approved/completed + pending).
        r#"WITH seller_balance AS (
            SELECT
                sp.id,
                GREATEST(
                    COALESCE((SELECT SUM(total_amount) FROM orders
                              WHERE seller_id = sp.id AND status IN ('delivered','confirmed')), 0)
                    - COALESCE((SELECT SUM(COALESCE(commission_amount, 0)) FROM orders
                                WHERE seller_id = sp.id AND status IN ('delivered','confirmed')), 0)
                    - COALESCE((SELECT SUM(amount) FROM withdrawal_requests
                                WHERE seller_id = sp.id AND status IN ('approved','completed','pending')), 0)
                    - COALESCE((SELECT SUM(total_amount) FROM orders
                                WHERE seller_id = sp.id AND status = 'refunded'), 0),
                    0
                ) AS net_balance
            FROM seller_profiles sp
            WHERE sp.status = 'approved'
        )
        SELECT
            (SELECT COUNT(*) FROM seller_profiles),
            (SELECT COUNT(*) FROM seller_profiles WHERE status = 'pending'),
            (SELECT COUNT(*) FROM seller_profiles WHERE status = 'approved'),
            (SELECT COUNT(*) FROM seller_profiles WHERE status = 'suspended'),
            (SELECT COUNT(*) FROM seller_profiles WHERE status = 'rejected'),
            (SELECT COUNT(*) FROM seller_profiles WHERE created_at >= CURRENT_DATE),
            (SELECT COALESCE(SUM(total_revenue), 0) FROM seller_profiles WHERE status = 'approved'),
            COALESCE((SELECT SUM(net_balance) FROM seller_balance), 0)
        "#,
    )
    .fetch_one(&state.db)
    .await?;

    let result = SellerStats {
        total_sellers: stats.0.unwrap_or(0),
        pending_sellers: stats.1.unwrap_or(0),
        approved_sellers: stats.2.unwrap_or(0),
        suspended_sellers: stats.3.unwrap_or(0),
        rejected_sellers: stats.4.unwrap_or(0),
        today_new: stats.5.unwrap_or(0),
        total_revenue: stats.6.unwrap_or_else(|| bigdecimal::BigDecimal::from(0)),
        total_balance: stats.7.unwrap_or_else(|| bigdecimal::BigDecimal::from(0)),
    };

    Ok(Json(json!({ "data": result })))
}

pub async fn update_seller_status(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<SellerStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    match req.status.as_str() {
        "approved" => {
            // GAP-05: fetch previous status for audit trail
            let prev_status = sqlx::query_scalar::<_, Option<String>>(
                "SELECT status FROM seller_profiles WHERE id = $1",
            )
            .bind(id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

            // Check if deposit is required and verified
            let required_deposit = sqlx::query_scalar::<_, String>(
                "SELECT value FROM system_settings WHERE key = 'seller_deposit_amount'",
            )
            .fetch_optional(&state.db)
            .await?
            .unwrap_or_else(|| "0".to_string());

            let required_deposit_amount: f64 = required_deposit.parse().unwrap_or(0.0);

            if required_deposit_amount > 0.0 {
                // Only enforce deposit for new approvals (not restoring from suspended)
                if prev_status.as_deref() != Some("suspended") {
                    // Round 6c (migration 046): seller_deposit_submissions.seller_id == seller_profiles(id).
                    // Path param `id` 가 곧 sp.id 라 추가 lookup 불필요.
                    let has_verified_deposit = sqlx::query_scalar::<_, bool>(
                        "SELECT EXISTS(SELECT 1 FROM seller_deposit_submissions WHERE seller_id = $1 AND status = 'verified')",
                    )
                    .bind(id)
                    .fetch_one(&state.db)
                    .await?;

                    if !has_verified_deposit {
                        return Err(AppError::Validation {
                            message: format!(
                                "판매자 보증금({} USDT)이 아직 확인되지 않았습니다. 보증금 확인 후 승인해주세요.",
                                required_deposit
                            ),
                            field: Some("deposit".into()),
                        });
                    }
                }
            }

            let result = sqlx::query(
                "UPDATE seller_profiles SET status = 'approved', rejected_reason = NULL, approved_at = NOW(), updated_at = NOW() WHERE id = $1",
            ).bind(id).execute(&state.db).await?;
            if result.rows_affected() == 0 {
                return Err(AppError::NotFound("Seller not found".into()));
            }

            let user_id =
                sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
                    .bind(id)
                    .fetch_one(&state.db)
                    .await?;

            sqlx::query("UPDATE users SET role = 'seller' WHERE id = $1")
                .bind(user_id)
                .execute(&state.db)
                .await?;

            // If restoring from suspended, also restore seller's products
            let mut products_restored: u64 = 0;
            if prev_status.as_deref() == Some("suspended") {
                let res = sqlx::query(
                    "UPDATE products SET status = 'active', rejected_reason = NULL, updated_at = NOW() WHERE seller_id = $1 AND status = 'suspended' AND rejected_reason LIKE '판매자 정지:%'",
                ).bind(id).execute(&state.db).await?;
                products_restored = res.rows_affected();
            }

            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                user_id,
                "system",
                "판매자 승인",
                "판매자 신청이 승인되었습니다. 이제 상품을 등록할 수 있습니다.",
                Some("/seller/dashboard"),
            )
            .await;

            log_admin_action(&state.db, auth.id, "seller_approved", "seller", id,
                Some(json!({ "previous_status": prev_status, "products_restored": products_restored })), ip.clone()).await?;
            let _ = log_audit_action(&state.db, auth.id, "seller_approved", "seller", Some(id),
                Some(json!({ "previous_status": prev_status, "products_restored": products_restored })), ip).await;
            Ok(Json(
                json!({ "data": { "id": id, "status": "approved", "products_restored": products_restored } }),
            ))
        }
        "rejected" => {
            let reason = req.reason.as_deref().unwrap_or("관리자 거부");

            let result = sqlx::query(
                "UPDATE seller_profiles SET status = 'rejected', rejected_reason = $1, updated_at = NOW() WHERE id = $2 AND status = 'pending'",
            ).bind(reason).bind(id).execute(&state.db).await?;
            if result.rows_affected() == 0 {
                return Err(AppError::NotFound(
                    "Seller not found or not in pending status".into(),
                ));
            }

            let user_id =
                sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
                    .bind(id)
                    .fetch_one(&state.db)
                    .await?;

            // FR-07: Mark verified deposits as refund_pending on rejection
            // Round 6c: seller_deposit_submissions.seller_id == seller_profiles(id).
            let deposit_refund_count = sqlx::query(
                "UPDATE seller_deposit_submissions SET status = 'refund_pending', updated_at = NOW() WHERE seller_id = $1 AND status = 'verified'",
            ).bind(id).execute(&state.db).await?.rows_affected();

            if deposit_refund_count > 0 {
                let _ = create_notification(
                    &state.db,
                    Some(&state.ws_hub),
                    user_id,
                    "system",
                    "보증금 환불 안내",
                    "판매자 보증금 환불이 진행됩니다. 관리자가 확인 후 처리합니다.",
                    Some("/seller/settings"),
                )
                .await;
            }

            let msg = format!("판매자 신청이 거부되었습니다. 사유: {}", reason);
            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                user_id,
                "system",
                "판매자 거부",
                &msg,
                None,
            )
            .await;

            log_admin_action(
                &state.db,
                auth.id,
                "seller_rejected",
                "seller",
                id,
                Some(json!({ "reason": reason, "deposit_refund_initiated": deposit_refund_count })),
                ip.clone(),
            )
            .await?;
            let _ = log_audit_action(
                &state.db,
                auth.id,
                "seller_rejected",
                "seller",
                Some(id),
                Some(json!({ "reason": reason })),
                ip,
            )
            .await;
            Ok(Json(
                json!({ "data": { "id": id, "status": "rejected", "reason": reason, "deposit_refund_initiated": deposit_refund_count } }),
            ))
        }
        "suspended" => {
            let reason = req.reason.as_deref().unwrap_or("관리자 정지");

            let result = sqlx::query(
                "UPDATE seller_profiles SET status = 'suspended', rejected_reason = $1, updated_at = NOW() WHERE id = $2",
            ).bind(reason).bind(id).execute(&state.db).await?;
            if result.rows_affected() == 0 {
                return Err(AppError::NotFound("Seller not found".into()));
            }

            let user_id =
                sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
                    .bind(id)
                    .fetch_one(&state.db)
                    .await?;

            // FR-07: admin 역할 강등 방지
            let current_role = sqlx::query_scalar::<_, crate::domain::user::UserRole>(
                "SELECT role FROM users WHERE id = $1",
            )
            .bind(user_id)
            .fetch_one(&state.db)
            .await?;
            if current_role != crate::domain::user::UserRole::Admin {
                sqlx::query("UPDATE users SET role = 'user' WHERE id = $1")
                    .bind(user_id)
                    .execute(&state.db)
                    .await?;
            }

            // Auto-suspend all active products of this seller
            let suspended_products = sqlx::query(
                "UPDATE products SET status = 'suspended', rejected_reason = $1, updated_at = NOW() WHERE seller_id = $2 AND status = 'active'",
            ).bind(format!("판매자 정지: {}", reason)).bind(id).execute(&state.db).await?;

            // FR-07: Mark verified deposits as refund_pending on suspension
            // Round 6c: seller_deposit_submissions.seller_id == seller_profiles(id).
            let deposit_refund_count = sqlx::query(
                "UPDATE seller_deposit_submissions SET status = 'refund_pending', updated_at = NOW() WHERE seller_id = $1 AND status = 'verified'",
            ).bind(id).execute(&state.db).await?.rows_affected();

            if deposit_refund_count > 0 {
                let _ = create_notification(
                    &state.db,
                    Some(&state.ws_hub),
                    user_id,
                    "system",
                    "보증금 환불 안내",
                    "판매자 보증금 환불이 진행됩니다. 관리자가 확인 후 처리합니다.",
                    Some("/seller/settings"),
                )
                .await;
            }

            let msg = format!("판매자 활동이 정지되었습니다. 사유: {}", reason);
            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                user_id,
                "system",
                "판매자 정지",
                &msg,
                None,
            )
            .await;

            log_admin_action(&state.db, auth.id, "seller_suspended", "seller", id,
                Some(json!({ "reason": reason, "products_suspended": suspended_products.rows_affected(), "deposit_refund_initiated": deposit_refund_count })), ip).await?;
            Ok(Json(
                json!({ "data": { "id": id, "status": "suspended", "reason": reason, "products_suspended": suspended_products.rows_affected(), "deposit_refund_initiated": deposit_refund_count } }),
            ))
        }
        _ => Err(AppError::Validation {
            message: "status must be 'approved', 'rejected', or 'suspended'".into(),
            field: Some("status".into()),
        }),
    }
}

/// PUT /admin/sellers/{id}/wallet — 관리자 권한으로 판매자 지갑주소 변경
///
/// v1.3.10 운영 정책에서 판매자 본인은 지갑을 한 번 등록하면 변경 불가지만,
/// 분실/해킹/오기재 등 예외 상황에서 관리자가 직접 교체할 수 있어야 한다.
/// wallet_locked 잠금 여부와 무관하게 덮어쓴다.
pub async fn update_seller_wallet(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<SellerWalletUpdateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let new_addr = req.wallet_address.trim().to_string();
    crate::domain::wallet::validate_wallet_address(&new_addr)?;

    let prev_addr = sqlx::query_scalar::<_, String>(
        "SELECT wallet_address FROM seller_profiles WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Seller not found".into()))?;

    if prev_addr == new_addr {
        return Err(AppError::Validation {
            message: "기존 지갑 주소와 동일합니다.".into(),
            field: Some("wallet_address".into()),
        });
    }

    let result = sqlx::query(
        r#"UPDATE seller_profiles
           SET wallet_address = $1,
               wallet_locked = TRUE,
               updated_at = NOW()
           WHERE id = $2"#,
    )
    .bind(&new_addr)
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Seller not found".into()));
    }

    let user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(id)
            .fetch_one(&state.db)
            .await?;

    let _ = create_notification(
        &state.db,
        Some(&state.ws_hub),
        user_id,
        "system",
        "지갑 주소 변경",
        "관리자에 의해 판매 정산 지갑 주소가 변경되었습니다. 본인이 요청하지 않았다면 즉시 고객센터로 문의해주세요.",
        Some("/seller/settings"),
    )
    .await;

    let details = json!({
        "previous_wallet": prev_addr,
        "new_wallet": new_addr,
        "reason": req.reason,
    });
    log_admin_action(
        &state.db,
        auth.id,
        "seller_wallet_update",
        "seller",
        id,
        Some(details.clone()),
        ip.clone(),
    )
    .await?;
    let _ = log_audit_action(
        &state.db,
        auth.id,
        "seller_wallet_update",
        "seller",
        Some(id),
        Some(details),
        ip,
    )
    .await;

    Ok(Json(
        json!({ "data": { "id": id, "wallet_address": new_addr } }),
    ))
}

// --- User Management ---

pub async fn list_users(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<UserListResponse>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let search = params.q.as_deref().unwrap_or("");
    let search_pattern = search_pattern(search);
    let role_filter = params.role.as_deref().unwrap_or("%");

    let users = sqlx::query_as::<_, UserInfo>(
        r#"SELECT id, email, real_name, nickname, role, status, created_at, last_login_at,
                  COUNT(*) OVER() as total_count
           FROM users
           WHERE (email ILIKE $1 OR real_name ILIKE $1 OR COALESCE(nickname, '') ILIKE $1)
             AND role LIKE $4
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(&search_pattern)
    .bind(per_page)
    .bind(offset)
    .bind(role_filter)
    .fetch_all(&state.db)
    .await?;

    let total = users.first().and_then(|u| u.total_count).unwrap_or(0);

    Ok(Json(UserListResponse {
        data: users,
        pagination: Pagination::new(page, per_page, total),
    }))
}

pub async fn user_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let row = sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64, i64, i64)>(
        r#"SELECT
            COUNT(*) as total_users,
            COUNT(*) FILTER (WHERE role = 'buyer') as buyers,
            COUNT(*) FILTER (WHERE role = 'seller') as sellers,
            COUNT(*) FILTER (WHERE role = 'admin') as admins,
            COUNT(*) FILTER (WHERE status = 'active' OR status IS NULL) as active_users,
            COUNT(*) FILTER (WHERE status = 'banned') as banned_users,
            COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_7d
           FROM users
           WHERE withdrawn_at IS NULL"#,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": {
            "total_users": row.0,
            "buyers": row.1,
            "sellers": row.2,
            "admins": row.3,
            "active_users": row.4,
            "banned_users": row.5,
            "suspended_users": row.6,
            "new_users_7d": row.7
        }
    })))
}

pub async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user = sqlx::query_as::<_, crate::domain::admin::UserDetail>(
        r#"SELECT id, username, email, phone, real_name, nickname, profile_image,
                  role, is_email_verified, is_phone_verified, is_udg_member, is_2fa_enabled,
                  locale, status, withdrawn_at, last_login_at, last_login_ip::TEXT as last_login_ip,
                  created_at, updated_at
           FROM users WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Seller profile (if exists)
    let seller_profile = sqlx::query_as::<_, crate::domain::admin::UserSellerProfile>(
        r#"SELECT id as seller_id, seller_type, wallet_address, contact_phone,
                  deposit_amount, balance, total_sales, total_revenue,
                  avg_rating, response_rate, avg_ship_days,
                  grade, grade_score, dispute_count,
                  status as seller_status, approved_at,
                  created_at as seller_created_at
           FROM seller_profiles WHERE user_id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    // Seller grade (from seller_grades table, if exists)
    // Round 6b (migration 045): seller_grades.seller_id == seller_profiles(id).
    // path param `id` (user_id) 를 sp.id 로 변환 후 조회.
    let seller_grade = sqlx::query_as::<_, crate::domain::admin::UserSellerGrade>(
        r#"SELECT sg.grade, sg.score, sg.total_sales, sg.avg_rating, sg.response_rate,
                  sg.dispute_rate, sg.calculated_at
           FROM seller_grades sg
           JOIN seller_profiles sp ON sp.id = sg.seller_id
           WHERE sp.user_id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    // Order statistics
    let order_stats = sqlx::query_as::<_, crate::domain::admin::UserOrderStats>(
        r#"SELECT COUNT(*) as total_orders,
                  COALESCE(SUM(total_amount), 0) as total_spent,
                  COUNT(*) FILTER (WHERE status IN ('delivered', 'completed', 'confirmed')) as completed_orders,
                  COUNT(*) FILTER (WHERE status IN ('cancelled', 'refunded')) as cancelled_orders
           FROM orders WHERE buyer_id = $1"#,
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "data": {
            "user": user,
            "seller_profile": seller_profile,
            "seller_grade": seller_grade,
            "order_stats": order_stats,
        }
    })))
}

pub async fn update_user(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<crate::domain::admin::UserUpdateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    // Prevent modifying admin users (FR-06)
    let target_role = sqlx::query_scalar::<_, crate::domain::user::UserRole>(
        "SELECT role FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    if target_role == crate::domain::user::UserRole::Admin && auth.id != id {
        return Err(AppError::Forbidden(
            "Cannot modify other admin users".into(),
        ));
    }

    // LOW backlog (Audit Admin L-1): admin 이 자기 자신의 status/role 변경 차단.
    // middleware 가 다음 요청에서 막긴 하지만 momentary 잘못된 상태 + audit log 의 노이즈
    // 방지를 위해 사전 차단.
    if auth.id == id && (req.status.is_some() || req.role.is_some()) {
        return Err(AppError::Forbidden(
            "Cannot modify your own status or role. Contact another admin or super-admin.".into(),
        ));
    }

    // Validate role if provided
    if let Some(ref role) = req.role {
        if !["buyer", "seller", "admin"].contains(&role.as_str()) {
            return Err(AppError::Validation {
                message: "role must be 'buyer', 'seller', or 'admin'".into(),
                field: Some("role".into()),
            });
        }
        // Prevent setting admin role on non-admin users (security)
        if role == "admin" && target_role != crate::domain::user::UserRole::Admin {
            return Err(AppError::Forbidden("Cannot grant admin role".into()));
        }
    }

    // Validate status if provided
    if let Some(ref status) = req.status {
        if !["active", "banned", "suspended", "inactive"].contains(&status.as_str()) {
            return Err(AppError::Validation {
                message: "status must be 'active', 'banned', 'suspended', or 'inactive'".into(),
                field: Some("status".into()),
            });
        }
    }

    // Validate email uniqueness if changing
    if let Some(ref email) = req.email {
        if email.is_empty() || !email.contains('@') {
            return Err(AppError::Validation {
                message: "Invalid email format".into(),
                field: Some("email".into()),
            });
        }
        let existing =
            sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE email = $1 AND id != $2")
                .bind(email)
                .bind(id)
                .fetch_optional(&state.db)
                .await?;
        if existing.is_some() {
            return Err(AppError::Validation {
                message: "Email already in use".into(),
                field: Some("email".into()),
            });
        }
    }

    // Validate phone format (E.164) and uniqueness if changing.
    // 공백 문자열을 보내면 phone 을 비우는 것으로 해석. (관리자가 잘못 등록된 번호 삭제 가능.)
    let phone_to_set: Option<Option<String>> = match req.phone.as_ref() {
        None => None,
        Some(p) if p.trim().is_empty() => Some(None),
        Some(p) => {
            let normalized = p.trim().to_string();
            if !normalized.starts_with('+') || normalized.len() < 8 || normalized.len() > 16 {
                return Err(AppError::Validation {
                    message: "Invalid phone format (E.164, e.g. +821012345678)".into(),
                    field: Some("phone".into()),
                });
            }
            let digits: String = normalized
                .chars()
                .skip(1)
                .filter(|c| c.is_ascii_digit())
                .collect();
            if digits.len() < 7 || digits.len() > 15 {
                return Err(AppError::Validation {
                    message: "Invalid phone number length".into(),
                    field: Some("phone".into()),
                });
            }
            let existing = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM users WHERE phone = $1 AND id != $2",
            )
            .bind(&normalized)
            .bind(id)
            .fetch_optional(&state.db)
            .await?;
            if existing.is_some() {
                return Err(AppError::Validation {
                    message: "Phone already in use".into(),
                    field: Some("phone".into()),
                });
            }
            Some(Some(normalized))
        }
    };

    // Build dynamic UPDATE query.
    // phone 필드는 NULL 로 명시적으로 비울 수 있어야 해서 COALESCE 대신
    // "값이 None 이면 기존값 유지" 패턴을 별도 CASE 로 처리한다.
    let phone_provided = phone_to_set.is_some();
    let phone_value = phone_to_set.flatten();
    let result = sqlx::query(
        r#"UPDATE users SET
            email = COALESCE($2, email),
            role = COALESCE($3, role),
            nickname = COALESCE($4, nickname),
            status = COALESCE($5, status),
            is_email_verified = COALESCE($6, is_email_verified),
            is_phone_verified = COALESCE($7, is_phone_verified),
            is_udg_member = COALESCE($8, is_udg_member),
            phone = CASE WHEN $9 THEN $10 ELSE phone END,
            updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(&req.email)
    .bind(&req.role)
    .bind(&req.nickname)
    .bind(&req.status)
    .bind(req.is_email_verified)
    .bind(req.is_phone_verified)
    .bind(req.is_udg_member)
    .bind(phone_provided)
    .bind(&phone_value)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("User not found".into()));
    }

    // 2FA reset: clear totp_secret and disable 2FA
    if req.reset_2fa == Some(true) {
        sqlx::query(
            "UPDATE users SET totp_secret = NULL, is_2fa_enabled = FALSE, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    // phone 이 명시적으로 변경된 경우 (요청에 phone 키가 있던 경우) udg 로 동기화 이벤트 발송.
    // udg 가입자 아니어도 enqueue 비용은 1 row INSERT 라 큰 부담 없고, udg 핸들러가
    // 매칭 안 되는 회원은 ignored 처리해서 안전. is_udg_member 체크로 노이즈만 제거.
    if phone_provided {
        let is_udg: bool = sqlx::query_scalar("SELECT is_udg_member FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or(false);

        if is_udg {
            if let Err(e) = crate::domain::udg::enqueue_udg_user_updated(
                &state.db,
                id,
                phone_value.as_deref(),
            )
            .await
            {
                tracing::warn!(
                    "Failed to enqueue UDG user.updated (phone sync) for user {}: {}",
                    id,
                    e
                );
            } else {
                let state_bg = state.clone();
                tokio::spawn(async move {
                    if let Err(e) =
                        crate::scheduler::webhook::process_webhook_queue(&state_bg).await
                    {
                        tracing::warn!(
                            "Immediate webhook dispatch (user.updated) failed, scheduler will retry: {}",
                            e
                        );
                    }
                });
            }
        }
    }

    log_admin_action(
        &state.db,
        auth.id,
        "user_update",
        "user",
        id,
        Some(json!({
            "email": req.email,
            "phone": req.phone,
            "role": req.role,
            "nickname": req.nickname,
            "status": req.status,
            "is_email_verified": req.is_email_verified,
            "is_phone_verified": req.is_phone_verified,
            "is_udg_member": req.is_udg_member,
            "reset_2fa": req.reset_2fa,
        })),
        ip,
    )
    .await?;

    Ok(Json(json!({ "data": { "id": id, "updated": true } })))
}

pub async fn block_user(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UserBlockRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    // FR-06: admin 사용자 차단 방지
    let target_role = sqlx::query_scalar::<_, crate::domain::user::UserRole>(
        "SELECT role FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    if target_role == crate::domain::user::UserRole::Admin {
        return Err(AppError::Forbidden("Cannot block admin users".into()));
    }

    let new_status = if req.blocked { "banned" } else { "active" };

    let result = sqlx::query("UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_status)
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("User not found".into()));
    }

    let action = if req.blocked {
        "user_block"
    } else {
        "user_unblock"
    };
    log_admin_action(&state.db, auth.id, action, "user", id, None, ip.clone()).await?;
    let _ = log_audit_action(
        &state.db,
        auth.id,
        action,
        "user",
        Some(id),
        Some(json!({ "new_status": new_status })),
        ip,
    )
    .await;

    Ok(Json(json!({ "data": { "id": id, "status": new_status } })))
}

// --- Review Management ---

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AdminReview {
    pub id: Uuid,
    pub product_id: Uuid,
    pub product_title: Option<String>,
    pub product_status: Option<String>,
    pub seller_name: Option<String>,
    pub seller_id: Option<Uuid>,
    pub buyer_nickname: Option<String>,
    pub rating: i16,
    pub content: Option<String>,
    pub seller_reply: Option<String>,
    pub is_reported: Option<bool>,
    pub report_reason: Option<String>,
    pub is_hidden: Option<bool>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing)]
    pub total_count: Option<i64>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct LowRatedProduct {
    pub product_id: Uuid,
    pub product_title: String,
    pub seller_name: Option<String>,
    pub product_status: Option<String>,
    pub review_count: Option<i64>,
    pub avg_rating: Option<bigdecimal::BigDecimal>,
    pub low_rating_count: Option<i64>,
}

/// GET /admin/reviews — list all reviews with filters
pub async fn list_admin_reviews(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let filter = params.status.as_deref().unwrap_or("");
    let search = params.q.as_deref().unwrap_or("");
    let search_pattern = search_pattern(search);

    let order_clause = match params.sort.as_deref() {
        Some("rating_asc") => "r.rating ASC, r.created_at DESC",
        Some("rating_desc") => "r.rating DESC, r.created_at DESC",
        Some("created_asc") => "r.created_at ASC",
        _ => "r.created_at DESC",
    };

    let filter_clause = match filter {
        "reported" => "AND r.is_reported = true",
        "hidden" => "AND r.is_hidden = true",
        "low" => "AND r.rating <= 2",
        "no_reply" => "AND r.seller_reply IS NULL",
        "has_reply" => "AND r.seller_reply IS NOT NULL",
        _ => "",
    };

    let query = format!(
        r#"SELECT r.id, r.product_id,
                  p.title as product_title, p.status as product_status,
                  COALESCE(u_seller.nickname, u_seller.username) as seller_name,
                  p.seller_id,
                  COALESCE(u_buyer.nickname, u_buyer.username) as buyer_nickname,
                  r.rating, r.content, r.seller_reply,
                  r.is_reported, r.report_reason, r.is_hidden,
                  r.created_at,
                  COUNT(*) OVER() as total_count
           FROM reviews r
           JOIN products p ON p.id = r.product_id
           JOIN seller_profiles sp ON sp.id = p.seller_id
           JOIN users u_seller ON u_seller.id = sp.user_id
           JOIN users u_buyer ON u_buyer.id = r.buyer_id
           WHERE (p.title ILIKE $1 OR u_seller.nickname ILIKE $1 OR u_buyer.nickname ILIKE $1 OR r.content ILIKE $1)
             {}
           ORDER BY {}
           LIMIT $2 OFFSET $3"#,
        filter_clause, order_clause
    );

    let reviews = sqlx::query_as::<_, AdminReview>(&query)
        .bind(&search_pattern)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

    let total = reviews.first().and_then(|r| r.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": reviews,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

/// GET /admin/reviews/stats — review statistics
pub async fn review_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query(
        r#"SELECT
            (SELECT COUNT(*) FROM reviews) as total_reviews,
            (SELECT COALESCE(AVG(rating), 0) FROM reviews) as avg_rating,
            (SELECT COUNT(*) FROM reviews WHERE is_reported = true) as reported_count,
            (SELECT COUNT(*) FROM reviews WHERE is_hidden = true) as hidden_count,
            (SELECT COUNT(*) FROM reviews WHERE rating <= 2) as low_rating_count,
            (SELECT COUNT(*) FROM reviews WHERE seller_reply IS NULL) as no_reply_count,
            (SELECT COUNT(*) FROM reviews WHERE created_at > NOW() - INTERVAL '7 days') as week_new_count"#,
    )
    .fetch_one(&state.db)
    .await?;

    use sqlx::Row;
    Ok(Json(json!({
        "data": {
            "total_reviews": stats.get::<i64, _>("total_reviews"),
            "avg_rating": stats.get::<bigdecimal::BigDecimal, _>("avg_rating"),
            "reported_count": stats.get::<i64, _>("reported_count"),
            "hidden_count": stats.get::<i64, _>("hidden_count"),
            "low_rating_count": stats.get::<i64, _>("low_rating_count"),
            "no_reply_count": stats.get::<i64, _>("no_reply_count"),
            "week_new_count": stats.get::<i64, _>("week_new_count"),
        }
    })))
}

/// GET /admin/reviews/low-rated — products with consistently low ratings
pub async fn low_rated_products(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let products = sqlx::query_as::<_, LowRatedProduct>(
        r#"SELECT r.product_id,
                  p.title as product_title,
                  COALESCE(u.nickname, u.username) as seller_name,
                  p.status as product_status,
                  COUNT(*) as review_count,
                  AVG(r.rating) as avg_rating,
                  COUNT(*) FILTER (WHERE r.rating <= 2) as low_rating_count
           FROM reviews r
           JOIN products p ON p.id = r.product_id
           JOIN seller_profiles sp ON sp.id = p.seller_id
           JOIN users u ON u.id = sp.user_id
           GROUP BY r.product_id, p.title, u.nickname, u.username, p.status
           HAVING COUNT(*) >= 2 AND AVG(r.rating) <= 3.0
           ORDER BY AVG(r.rating) ASC, COUNT(*) FILTER (WHERE r.rating <= 2) DESC
           LIMIT 20"#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "data": products })))
}

/// PUT /admin/reviews/{id}/hide — hide a review
pub async fn hide_review(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query(
        "UPDATE reviews SET is_hidden = NOT COALESCE(is_hidden, false), updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Review not found".into()));
    }

    log_admin_action(
        &state.db,
        auth.id,
        "review_hide_toggle",
        "review",
        id,
        None,
        ip,
    )
    .await?;

    Ok(Json(json!({ "data": { "id": id, "toggled": true } })))
}

/// DELETE /admin/reviews/{id} — delete a review
pub async fn delete_review(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    let result = sqlx::query("DELETE FROM reviews WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Review not found".into()));
    }

    log_admin_action(&state.db, auth.id, "review_delete", "review", id, None, ip).await?;

    Ok(Json(json!({ "data": { "id": id, "deleted": true } })))
}

// --- Shipping Management ---

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AdminShipment {
    pub order_id: Uuid,
    pub order_number: String,
    pub buyer_name: Option<String>,
    pub seller_name: Option<String>,
    pub seller_id: Option<Uuid>,
    pub order_status: String,
    pub carrier_name: Option<String>,
    pub tracking_number: Option<String>,
    pub shipping_status: Option<String>,
    pub total_amount: Option<bigdecimal::BigDecimal>,
    pub ordered_at: Option<chrono::DateTime<chrono::Utc>>,
    pub shipped_at: Option<chrono::DateTime<chrono::Utc>>,
    pub delivered_at: Option<chrono::DateTime<chrono::Utc>>,
    pub auto_confirm_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing)]
    pub total_count: Option<i64>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct SellerShippingPerformance {
    pub seller_id: Uuid,
    pub seller_name: Option<String>,
    pub total_orders: Option<i64>,
    pub shipped_count: Option<i64>,
    pub delivered_count: Option<i64>,
    pub avg_ship_days: Option<f64>,
    pub on_time_rate: Option<f64>,
    pub exception_count: Option<i64>,
    pub pending_ship_count: Option<i64>,
}

/// GET /admin/shipping — list all shipments with filters
pub async fn list_admin_shipments(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let filter = params.status.as_deref().unwrap_or("");
    let search = params.q.as_deref().unwrap_or("");
    let search_pattern = search_pattern(search);

    let order_clause = match params.sort.as_deref() {
        Some("shipped_asc") => "o.shipped_at ASC NULLS LAST",
        Some("shipped_desc") => "o.shipped_at DESC NULLS LAST",
        Some("ordered_asc") => "o.created_at ASC",
        Some("amount_desc") => "o.total_amount DESC",
        _ => "o.created_at DESC",
    };

    // Filter: payment_verified (awaiting shipment), shipped, delivered, exception, overdue
    let filter_clause = match filter {
        "awaiting" => "AND o.status = 'payment_verified'",
        "shipped" => "AND o.status = 'shipped'",
        "delivered" => "AND o.status = 'delivered'",
        "exception" => "AND dt.status = 'exception'",
        "overdue" => {
            "AND o.status = 'payment_verified' AND o.created_at < NOW() - INTERVAL '3 days'"
        }
        "confirmed" => "AND o.status = 'confirmed'",
        _ => "AND o.status IN ('payment_verified', 'shipped', 'delivered', 'confirmed')",
    };

    let query = format!(
        r#"SELECT o.id as order_id, o.order_number,
                  COALESCE(u_buyer.nickname, u_buyer.username) as buyer_name,
                  COALESCE(u_seller.nickname, u_seller.username) as seller_name,
                  sp.id as seller_id,
                  o.status as order_status,
                  dt.carrier_name, dt.tracking_number,
                  dt.status as shipping_status,
                  o.total_amount,
                  o.created_at as ordered_at,
                  o.shipped_at, o.delivered_at, o.auto_confirm_at,
                  COUNT(*) OVER() as total_count
           FROM orders o
           JOIN users u_buyer ON u_buyer.id = o.buyer_id
           JOIN seller_profiles sp ON sp.id = o.seller_id
           JOIN users u_seller ON u_seller.id = sp.user_id
           LEFT JOIN delivery_trackings dt ON dt.order_id = o.id
           WHERE (o.order_number ILIKE $1 OR u_buyer.nickname ILIKE $1 OR u_seller.nickname ILIKE $1
                  OR u_buyer.username ILIKE $1 OR u_seller.username ILIKE $1
                  OR dt.tracking_number ILIKE $1)
             {}
           ORDER BY {}
           LIMIT $2 OFFSET $3"#,
        filter_clause, order_clause
    );

    let shipments = sqlx::query_as::<_, AdminShipment>(&query)
        .bind(&search_pattern)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

    let total = shipments.first().and_then(|s| s.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": shipments,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

/// GET /admin/shipping/stats — shipping statistics
pub async fn shipping_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = sqlx::query(
        r#"SELECT
            (SELECT COUNT(*) FROM orders WHERE status = 'payment_verified') as awaiting_shipment,
            (SELECT COUNT(*) FROM orders WHERE status = 'shipped') as in_transit,
            (SELECT COUNT(*) FROM orders WHERE status = 'delivered') as delivered,
            (SELECT COUNT(*) FROM orders WHERE status = 'confirmed') as confirmed,
            (SELECT COUNT(*) FROM orders WHERE status = 'payment_verified'
                AND created_at < NOW() - INTERVAL '3 days') as overdue,
            (SELECT COUNT(*) FROM delivery_trackings WHERE status = 'exception') as exceptions,
            (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (shipped_at - created_at)) / 86400.0), 0)::FLOAT8
                FROM orders WHERE shipped_at IS NOT NULL
                AND created_at > NOW() - INTERVAL '30 days') as avg_ship_days_30d,
            (SELECT COUNT(*) FROM orders WHERE status IN ('payment_verified', 'shipped', 'delivered', 'confirmed')
                AND created_at > NOW() - INTERVAL '7 days') as week_orders"#,
    )
    .fetch_one(&state.db)
    .await?;

    use sqlx::Row;
    Ok(Json(json!({
        "data": {
            "awaiting_shipment": stats.get::<i64, _>("awaiting_shipment"),
            "in_transit": stats.get::<i64, _>("in_transit"),
            "delivered": stats.get::<i64, _>("delivered"),
            "confirmed": stats.get::<i64, _>("confirmed"),
            "overdue": stats.get::<i64, _>("overdue"),
            "exceptions": stats.get::<i64, _>("exceptions"),
            "avg_ship_days_30d": stats.get::<f64, _>("avg_ship_days_30d"),
            "week_orders": stats.get::<i64, _>("week_orders"),
        }
    })))
}

/// GET /admin/shipping/overdue — orders awaiting shipment for too long
pub async fn overdue_shipments(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let orders = sqlx::query_as::<_, AdminShipment>(
        r#"SELECT o.id as order_id, o.order_number,
                  COALESCE(u_buyer.nickname, u_buyer.username) as buyer_name,
                  COALESCE(u_seller.nickname, u_seller.username) as seller_name,
                  sp.id as seller_id,
                  o.status as order_status,
                  NULL::VARCHAR as carrier_name, NULL::VARCHAR as tracking_number,
                  NULL::VARCHAR as shipping_status,
                  o.total_amount,
                  o.created_at as ordered_at,
                  o.shipped_at, o.delivered_at, o.auto_confirm_at,
                  COUNT(*) OVER() as total_count
           FROM orders o
           JOIN users u_buyer ON u_buyer.id = o.buyer_id
           JOIN seller_profiles sp ON sp.id = o.seller_id
           JOIN users u_seller ON u_seller.id = sp.user_id
           WHERE o.status = 'payment_verified'
             AND o.created_at < NOW() - INTERVAL '2 days'
           ORDER BY o.created_at ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = orders.first().and_then(|o| o.total_count).unwrap_or(0);

    Ok(Json(json!({
        "data": orders,
        "pagination": Pagination::new(page, per_page, total),
    })))
}

/// GET /admin/shipping/sellers — seller shipping performance ranking
pub async fn seller_shipping_performance(
    State(state): State<AppState>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let _page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let order_clause = match params.sort.as_deref() {
        Some("avg_ship_asc") => "avg_ship_days ASC NULLS LAST",
        Some("avg_ship_desc") => "avg_ship_days DESC NULLS LAST",
        Some("orders_desc") => "total_orders DESC",
        Some("on_time_asc") => "on_time_rate ASC NULLS LAST",
        _ => "total_orders DESC",
    };

    let query = format!(
        r#"SELECT
              sp.id as seller_id,
              COALESCE(u.nickname, u.username) as seller_name,
              COUNT(o.id) as total_orders,
              COUNT(o.id) FILTER (WHERE o.status IN ('shipped', 'delivered', 'confirmed')) as shipped_count,
              COUNT(o.id) FILTER (WHERE o.status IN ('delivered', 'confirmed')) as delivered_count,
              AVG(EXTRACT(EPOCH FROM (o.shipped_at - o.created_at)) / 86400.0)
                  FILTER (WHERE o.shipped_at IS NOT NULL) as avg_ship_days,
              CASE WHEN COUNT(o.id) FILTER (WHERE o.shipped_at IS NOT NULL) > 0
                   THEN COUNT(o.id) FILTER (WHERE o.shipped_at IS NOT NULL
                        AND EXTRACT(EPOCH FROM (o.shipped_at - o.created_at)) / 86400.0 <= 3)::FLOAT
                        / COUNT(o.id) FILTER (WHERE o.shipped_at IS NOT NULL)::FLOAT * 100.0
                   ELSE NULL END as on_time_rate,
              COUNT(dt.id) FILTER (WHERE dt.status = 'exception') as exception_count,
              COUNT(o.id) FILTER (WHERE o.status = 'payment_verified') as pending_ship_count
           FROM seller_profiles sp
           JOIN users u ON u.id = sp.user_id
           LEFT JOIN orders o ON o.seller_id = sp.id
               AND o.status IN ('payment_verified', 'shipped', 'delivered', 'confirmed')
               AND o.created_at > NOW() - INTERVAL '90 days'
           LEFT JOIN delivery_trackings dt ON dt.order_id = o.id
           WHERE sp.status = 'approved'
           GROUP BY sp.id, u.nickname, u.username
           HAVING COUNT(o.id) > 0
           ORDER BY {}
           LIMIT $1 OFFSET $2"#,
        order_clause
    );

    let sellers = sqlx::query_as::<_, SellerShippingPerformance>(&query)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(json!({
        "data": sellers,
    })))
}

/// FR-22: 관리자 채팅 모니터링 (분쟁 시 채팅 내역 열람)
pub async fn admin_chat_messages(
    State(state): State<AppState>,
    Path(order_id): Path<Uuid>,
    Query(params): Query<AdminSearchParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let per_page = params.per_page();
    let offset = params.offset();

    // 채팅방 조회
    let room = sqlx::query_as::<_, (Uuid, Uuid, Uuid)>(
        "SELECT id, buyer_id, seller_id FROM chat_rooms WHERE order_id = $1",
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Chat room not found for this order".into()))?;

    let (room_id, buyer_id, seller_id) = room;

    // 메시지 조회
    let messages = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            Option<String>,
            Option<String>,
            bool,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        r#"SELECT cm.id, cm.sender_id, cm.content,
                  COALESCE(cm.message_type, 'text'),
                  cm.image_url, cm.is_read, cm.created_at
           FROM chat_messages cm
           WHERE cm.room_id = $1
           ORDER BY cm.created_at ASC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(room_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chat_messages WHERE room_id = $1")
        .bind(room_id)
        .fetch_one(&state.db)
        .await?;

    // 참여자 이름
    let buyer_name = sqlx::query_scalar::<_, String>(
        "SELECT COALESCE(nickname, username) FROM users WHERE id = $1",
    )
    .bind(buyer_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or_else(|_| "Unknown".to_string());

    let seller_name = sqlx::query_scalar::<_, String>(
        "SELECT COALESCE(u.nickname, u.username) FROM users u JOIN seller_profiles sp ON sp.user_id = u.id WHERE sp.id = $1",
    )
    .bind(seller_id)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_else(|| "Unknown".to_string());

    let msgs: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            let sender_name = if m.1 == buyer_id {
                &buyer_name
            } else {
                &seller_name
            };
            serde_json::json!({
                "id": m.0,
                "sender_id": m.1,
                "sender_name": sender_name,
                "content": m.2,
                "message_type": m.3,
                "image_url": m.4,
                "is_read": m.5,
                "created_at": m.6,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "data": {
            "room_id": room_id,
            "order_id": order_id,
            "buyer_name": buyer_name,
            "seller_name": seller_name,
            "messages": msgs,
        },
        "pagination": crate::domain::common::Pagination::new(params.page(), per_page, total),
    })))
}

// --- Seller Deposit Verification ---

#[derive(Debug, serde::Deserialize)]
pub struct VerifyDepositRequest {
    pub action: String, // "verify" | "reject"
    pub admin_note: Option<String>,
}

/// PUT /admin/sellers/{id}/verify-deposit — Admin verifies seller deposit
pub async fn verify_seller_deposit(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(seller_profile_id): Path<Uuid>,
    Json(req): Json<VerifyDepositRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    if req.action != "verify" && req.action != "reject" {
        return Err(AppError::Validation {
            message: "action must be 'verify' or 'reject'".into(),
            field: Some("action".into()),
        });
    }

    // Get seller user_id from seller_profiles
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_profile_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    let mut tx = state.db.begin().await?;

    // Find the latest pending deposit for this seller
    // Round 6c (migration 046): seller_deposit_submissions.seller_id == seller_profiles(id).
    let deposit = sqlx::query_as::<_, (Uuid, bigdecimal::BigDecimal, String)>(
        r#"SELECT id, amount, txid FROM seller_deposit_submissions
           WHERE seller_id = $1 AND status = 'pending'
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE"#,
    )
    .bind(seller_profile_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::NotFound("No pending deposit submission found for this seller".into())
    })?;

    let (deposit_id, deposit_amount, deposit_txid) = deposit;

    match req.action.as_str() {
        "verify" => {
            // Update deposit submission status
            sqlx::query(
                r#"UPDATE seller_deposit_submissions
                   SET status = 'verified', verified_at = NOW(), admin_note = $1, updated_at = NOW()
                   WHERE id = $2"#,
            )
            .bind(&req.admin_note)
            .bind(deposit_id)
            .execute(&mut *tx)
            .await?;

            // Update seller_profiles deposit_amount and deposit_txid
            sqlx::query(
                r#"UPDATE seller_profiles
                   SET deposit_amount = $1, deposit_txid = $2, updated_at = NOW()
                   WHERE id = $3"#,
            )
            .bind(&deposit_amount)
            .bind(&deposit_txid)
            .bind(seller_profile_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;

            // Notify seller
            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                seller_user_id,
                "system",
                "보증금 확인 완료",
                "판매자 보증금이 확인되었습니다.",
                Some("/seller/profile"),
            )
            .await;

            log_admin_action(
                &state.db, auth.id, "seller_deposit_verified", "seller", seller_profile_id,
                Some(json!({ "deposit_id": deposit_id, "amount": deposit_amount.to_string(), "txid": deposit_txid })),
                ip,
            ).await?;

            Ok(Json(json!({
                "data": {
                    "id": deposit_id,
                    "status": "verified",
                    "amount": deposit_amount.to_string(),
                    "message": "보증금이 확인되었습니다."
                }
            })))
        }
        "reject" => {
            let note = req.admin_note.as_deref().unwrap_or("관리자 거절");

            sqlx::query(
                r#"UPDATE seller_deposit_submissions
                   SET status = 'rejected', admin_note = $1, updated_at = NOW()
                   WHERE id = $2"#,
            )
            .bind(note)
            .bind(deposit_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;

            // Notify seller
            let msg = format!("보증금 확인이 거절되었습니다. 사유: {}", note);
            let _ = create_notification(
                &state.db,
                Some(&state.ws_hub),
                seller_user_id,
                "system",
                "보증금 거절",
                &msg,
                Some("/seller/deposit"),
            )
            .await;

            log_admin_action(
                &state.db,
                auth.id,
                "seller_deposit_rejected",
                "seller",
                seller_profile_id,
                Some(json!({ "deposit_id": deposit_id, "reason": note })),
                ip,
            )
            .await?;

            Ok(Json(json!({
                "data": {
                    "id": deposit_id,
                    "status": "rejected",
                    "admin_note": note,
                }
            })))
        }
        _ => unreachable!(),
    }
}

/// PUT /admin/sellers/{id}/refund-deposit — Process deposit refund for a seller
pub async fn refund_seller_deposit(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Path(seller_profile_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ip = extract_ip(&headers, Some(&ConnectInfo(addr)));

    // Get seller user_id from seller_profiles
    let seller_user_id =
        sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM seller_profiles WHERE id = $1")
            .bind(seller_profile_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    let mut tx = state.db.begin().await?;

    // Find deposits in refund_pending status
    // Round 6c (migration 046): seller_deposit_submissions.seller_id == seller_profiles(id).
    let deposits = sqlx::query_as::<_, (Uuid, bigdecimal::BigDecimal)>(
        r#"SELECT id, amount FROM seller_deposit_submissions
           WHERE seller_id = $1 AND status = 'refund_pending'
           FOR UPDATE"#,
    )
    .bind(seller_profile_id)
    .fetch_all(&mut *tx)
    .await?;

    if deposits.is_empty() {
        // Audit Admin M-2 (2026-05-07): retry/double-click 시 404 대신 idempotent
        // 응답 반환. 이미 refunded 또는 환불 대상 없음 모두 정상 종결로 처리.
        tx.commit().await.ok();
        return Ok(Json(json!({
            "data": {
                "seller_id": seller_profile_id,
                "refunded_count": 0,
                "total_amount": "0",
                "status": "no_pending_deposits",
                "message": "No deposits pending refund (already refunded or none submitted)"
            }
        })));
    }

    let mut total_refunded = bigdecimal::BigDecimal::from(0);

    for (deposit_id, amount) in &deposits {
        sqlx::query(
            "UPDATE seller_deposit_submissions SET status = 'refunded', updated_at = NOW() WHERE id = $1",
        )
        .bind(deposit_id)
        .execute(&mut *tx)
        .await?;
        total_refunded += amount;
    }

    // Reset seller deposit_amount to 0
    sqlx::query(
        "UPDATE seller_profiles SET deposit_amount = 0, deposit_txid = NULL, updated_at = NOW() WHERE id = $1",
    )
    .bind(seller_profile_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Notify seller
    let _ = create_notification(
        &state.db,
        Some(&state.ws_hub),
        seller_user_id,
        "system",
        "보증금 환불 완료",
        &format!(
            "판매자 보증금 {} USDT가 환불 처리되었습니다.",
            total_refunded
        ),
        Some("/seller/settings"),
    )
    .await;

    log_admin_action(
        &state.db,
        auth.id,
        "seller_deposit_refunded",
        "seller",
        seller_profile_id,
        Some(
            json!({ "refunded_count": deposits.len(), "total_amount": total_refunded.to_string() }),
        ),
        ip,
    )
    .await?;

    Ok(Json(json!({
        "data": {
            "seller_id": seller_profile_id,
            "refunded_count": deposits.len(),
            "total_amount": total_refunded.to_string(),
            "status": "refunded"
        }
    })))
}
