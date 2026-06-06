use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use bigdecimal::BigDecimal;
use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::domain::order::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// FR-01: 주문 취소 시 재고 복원 (트랜잭션 내 사용 가능)
pub async fn restore_stock_tx(
    conn: &mut sqlx::PgConnection,
    order_id: Uuid,
) -> Result<(), AppError> {
    let items = sqlx::query_as::<_, (Uuid, Option<Uuid>, i32)>(
        "SELECT product_id, option_id, quantity FROM order_items WHERE order_id = $1",
    )
    .bind(order_id)
    .fetch_all(&mut *conn)
    .await?;

    for (product_id, option_id, quantity) in items {
        sqlx::query(
            "UPDATE products SET stock = stock + $1, sold_count = GREATEST(COALESCE(sold_count, 0) - $1, 0) WHERE id = $2",
        )
        .bind(quantity)
        .bind(product_id)
        .execute(&mut *conn)
        .await?;

        if let Some(opt_id) = option_id {
            sqlx::query("UPDATE product_options SET stock = stock + $1 WHERE id = $2")
                .bind(quantity)
                .bind(opt_id)
                .execute(&mut *conn)
                .await?;
        }
    }
    Ok(())
}

/// FR-01: PgPool 래퍼 (스케줄러 등 standalone 사용 시 자체 트랜잭션)
pub async fn restore_stock(db: &sqlx::PgPool, order_id: Uuid) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    restore_stock_tx(&mut tx, order_id).await?;
    tx.commit().await?;
    Ok(())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_order))
        .route("/", get(list_orders))
        .route("/{id}", get(get_order))
        .route("/{id}/txid", post(submit_txid))
        .route("/{id}/network", axum::routing::put(update_payment_network))
        .route("/{id}/confirm", post(confirm_order))
        .route("/{id}/cancel", post(cancel_order))
}

pub fn seller_router() -> Router<AppState> {
    Router::new().route("/orders", get(seller_orders))
}

pub fn public_router() -> Router<AppState> {
    Router::new().route("/payment-networks", get(list_payment_networks))
}

/// 공개 엔드포인트: admin이 system_settings 에 설정한 결제 네트워크 목록 반환.
/// env COMPANY_WALLET_* 폴백은 의도적으로 무시 (order 생성 시 안전망일 뿐 admin 의도 아님).
/// 응답 예: {"data": ["TRC-20", "BEP-20"]}
async fn list_payment_networks(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT key, value FROM system_settings WHERE key IN ('company_wallet_tron', 'company_wallet_eth', 'company_wallet_address')",
    )
    .fetch_all(&state.db)
    .await?;

    let has = |k: &str| {
        rows.iter()
            .any(|(key, value)| key == k && !value.trim().is_empty())
    };

    let mut available: Vec<&'static str> = Vec::new();
    if has("company_wallet_tron") {
        available.push("TRC-20");
    }
    if has("company_wallet_eth") {
        available.push("ERC-20");
    }
    if has("company_wallet_address") {
        available.push("BEP-20");
    }

    Ok(Json(serde_json::json!({ "data": available })))
}

async fn create_order(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateOrderRequest>,
) -> Result<Json<OrderCreatedResponse>, AppError> {
    // FR-20: User-keyed rate limit (5/min per user)
    crate::middleware::rate_limit::check_user_rate_limit(
        &state.user_rate_limiters.orders,
        auth.id,
    )?;

    if req.items.is_empty() {
        return Err(AppError::Validation {
            message: "Order must have at least one item".into(),
            field: Some("items".into()),
        });
    }
    if req.items.len() > 100 {
        return Err(AppError::Validation {
            message: "Order must not exceed 100 items".into(),
            field: Some("items".into()),
        });
    }

    // 주문자 정보 검증: 인증된 사용자의 DB nickname/phone 과 일치해야 함
    if let (Some(orderer_name), Some(orderer_phone)) =
        (req.orderer_name.as_deref(), req.orderer_phone.as_deref())
    {
        let user_info: (Option<String>, Option<String>) =
            sqlx::query_as("SELECT nickname, phone FROM users WHERE id = $1")
                .bind(auth.id)
                .fetch_one(&state.db)
                .await?;
        let db_nickname = user_info.0.unwrap_or_default();
        let db_phone = user_info.1.unwrap_or_default();
        if orderer_name.trim() != db_nickname.trim() {
            return Err(AppError::Validation {
                message: "주문자 정보가 회원 정보와 일치하지 않습니다.".into(),
                field: Some("orderer_name".into()),
            });
        }
        if orderer_phone.trim() != db_phone.trim() {
            return Err(AppError::Validation {
                message: "주문자 연락처가 회원 정보와 일치하지 않습니다.".into(),
                field: Some("orderer_phone".into()),
            });
        }
    }

    // Input length validation for shipping fields
    if req.recipient_name.is_empty() || req.recipient_name.len() > 100 {
        return Err(AppError::Validation {
            message: "Recipient name must be between 1 and 100 characters".into(),
            field: Some("recipient_name".into()),
        });
    }
    if req.recipient_phone.is_empty() || req.recipient_phone.len() > 30 {
        return Err(AppError::Validation {
            message: "Recipient phone must be between 1 and 30 characters".into(),
            field: Some("recipient_phone".into()),
        });
    }
    if req.zipcode.is_empty() || req.zipcode.len() > 20 {
        return Err(AppError::Validation {
            message: "Zipcode must be between 1 and 20 characters".into(),
            field: Some("zipcode".into()),
        });
    }
    if req.address1.is_empty() || req.address1.len() > 500 {
        return Err(AppError::Validation {
            message: "Address must be between 1 and 500 characters".into(),
            field: Some("address1".into()),
        });
    }
    if let Some(ref addr2) = req.address2 {
        if addr2.len() > 500 {
            return Err(AppError::Validation {
                message: "Address detail must not exceed 500 characters".into(),
                field: Some("address2".into()),
            });
        }
    }
    if let Some(ref memo) = req.shipping_memo {
        if memo.len() > 500 {
            return Err(AppError::Validation {
                message: "Shipping memo must not exceed 500 characters".into(),
                field: Some("shipping_memo".into()),
            });
        }
    }

    // Validate payment_network if provided
    if let Some(ref network) = req.payment_network {
        if !["ERC-20", "TRC-20", "BEP-20"].contains(&network.as_str()) {
            return Err(AppError::Validation {
                message: "payment_network must be one of: ERC-20, TRC-20, BEP-20".into(),
                field: Some("payment_network".into()),
            });
        }
    }

    // Try admin settings first, fallback to env config
    // Select wallet address based on payment_network
    let company_wallet = {
        let settings_key = match req.payment_network.as_deref() {
            Some("TRC-20") => "company_wallet_tron",
            Some("ERC-20") => "company_wallet_eth",
            _ => "company_wallet_address", // BEP-20 or default
        };

        let db_wallet: Option<String> =
            sqlx::query_scalar("SELECT value FROM system_settings WHERE key = $1")
                .bind(settings_key)
                .fetch_optional(&state.db)
                .await
                .unwrap_or_else(|e| {
                    tracing::warn!(
                        "Failed to query system_settings for wallet (key={}): {e}",
                        settings_key
                    );
                    None
                });
        tracing::debug!(
            "DB wallet (key={}): {:?}, env wallet: {:?}",
            settings_key,
            db_wallet,
            state.config.company_wallet_address
        );
        let wallet = db_wallet
            .filter(|w| !w.trim().is_empty())
            .unwrap_or_else(|| state.config.company_wallet_address.clone());
        if wallet.is_empty() {
            return Err(AppError::Internal(anyhow::anyhow!("Company wallet not configured for network {:?}. Check system_settings key '{}' or COMPANY_WALLET_ADDRESS env", req.payment_network, settings_key)));
        }
        wallet
    };

    let mut tx = state.db.begin().await?;

    // Group items by seller
    use std::collections::HashMap;

    struct SellerItemData {
        item: OrderItemRequest,
        unit_price: BigDecimal,
        shipping_fee: BigDecimal,
        title: String,
        option_label: Option<String>,
        margin_rate: BigDecimal,
        commission_rate: BigDecimal,
    }

    #[derive(sqlx::FromRow)]
    struct ProductStockRow {
        seller_id: Uuid,
        stock: i32,
        final_price: Option<BigDecimal>,
        shipping_fee: BigDecimal,
        title: String,
        margin_rate: Option<BigDecimal>,
        commission_rate: Option<BigDecimal>,
        user_id: Uuid,
    }

    #[derive(sqlx::FromRow)]
    struct ProductOptionRow {
        stock: i32,
        option_name: String,
        option_value: String,
        additional_price: Option<BigDecimal>,
    }

    let mut seller_items: HashMap<Uuid, Vec<SellerItemData>> = HashMap::new();

    for item in &req.items {
        if item.quantity < 1 {
            return Err(AppError::Validation {
                message: "Quantity must be at least 1".into(),
                field: Some("quantity".into()),
            });
        }
        if item.quantity > 9999 {
            return Err(AppError::Validation {
                message: "Quantity must not exceed 9999".into(),
                field: Some("quantity".into()),
            });
        }
        if let Some(ref expected) = item.expected_price {
            if expected <= &BigDecimal::from(0) {
                return Err(AppError::Validation {
                    message: "Expected price must be positive".into(),
                    field: Some("expected_price".into()),
                });
            }
        }

        // Lock stock with FOR UPDATE; join seller_profiles to eliminate N+1 seller lookup
        let product = sqlx::query_as::<_, ProductStockRow>(
            r#"SELECT p.seller_id, p.stock, p.final_price, p.shipping_fee, p.title, p.margin_rate, p.commission_rate, sp.user_id
               FROM products p
               JOIN seller_profiles sp ON sp.id = p.seller_id
               WHERE p.id = $1 AND p.status = 'active' FOR UPDATE OF p"#,
        )
        .bind(item.product_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Product not found or not active".into()))?;

        let seller_id = product.seller_id;
        let stock = product.stock;
        let final_price = product.final_price.unwrap_or_else(|| BigDecimal::from(0));
        let shipping_fee = product.shipping_fee;
        let title = product.title;
        let margin_rate = product.margin_rate;
        let commission_rate = product
            .commission_rate
            .unwrap_or_else(|| BigDecimal::from(0));
        // v1.2.0: 자기 상품 구매 허용. UDG 분배 보상도 buyer 트리에 정상 적용됨.
        // (정책: 셀러 본인이 자기 상품을 사도 회사 수수료는 정상 부과·분배)
        let _seller_user_id = product.user_id;

        // FR-12: expected_price 검증
        if let Some(ref expected) = item.expected_price {
            if expected != &final_price {
                return Err(AppError::Validation {
                    message: format!(
                        "Price changed for {}. Expected: {}, Actual: {}",
                        title, expected, final_price
                    ),
                    field: Some("expected_price".into()),
                });
            }
        }

        // Check option stock if applicable
        let mut option_label = None;
        let mut additional_price = BigDecimal::from(0);
        if let Some(opt_id) = item.option_id {
            let opt = sqlx::query_as::<_, ProductOptionRow>(
                "SELECT stock, option_name, option_value, additional_price FROM product_options WHERE id = $1 AND product_id = $2 FOR UPDATE",
            )
            .bind(opt_id)
            .bind(item.product_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::NotFound("Product option not found".into()))?;

            if opt.stock < item.quantity {
                return Err(AppError::Validation {
                    message: format!(
                        "Insufficient stock for option {} {}",
                        opt.option_name, opt.option_value
                    ),
                    field: Some("quantity".into()),
                });
            }

            option_label = Some(format!("{}: {}", opt.option_name, opt.option_value));
            additional_price = opt.additional_price.unwrap_or_else(|| BigDecimal::from(0));

            sqlx::query("UPDATE product_options SET stock = stock - $1 WHERE id = $2")
                .bind(item.quantity)
                .bind(opt_id)
                .execute(&mut *tx)
                .await?;
        }

        if stock < item.quantity {
            return Err(AppError::Validation {
                message: format!("Insufficient stock for {}", title),
                field: Some("quantity".into()),
            });
        }

        // Deduct stock
        sqlx::query("UPDATE products SET stock = stock - $1, sold_count = COALESCE(sold_count, 0) + $1 WHERE id = $2")
            .bind(item.quantity)
            .bind(item.product_id)
            .execute(&mut *tx)
            .await?;

        let unit_price = &final_price + &additional_price;
        let mr = margin_rate.unwrap_or_else(|| BigDecimal::from(0));
        seller_items
            .entry(seller_id)
            .or_default()
            .push(SellerItemData {
                item: OrderItemRequest {
                    product_id: item.product_id,
                    option_id: item.option_id,
                    quantity: item.quantity,
                    expected_price: item.expected_price.clone(),
                },
                unit_price,
                shipping_fee: shipping_fee.clone(),
                title,
                option_label,
                margin_rate: mr,
                commission_rate,
            });
    }

    // Create one order per seller (deterministic iteration order for coupon distribution)
    let mut created_orders = Vec::new();
    let txid_deadline = Utc::now() + Duration::hours(24);

    // Sort seller_ids for deterministic coupon distribution
    let mut seller_order: Vec<_> = seller_items.keys().cloned().collect();
    seller_order.sort();

    for seller_id in &seller_order {
        let items = seller_items.get(seller_id).unwrap();
        let mut subtotal = BigDecimal::from(0);
        let mut max_shipping = BigDecimal::from(0);
        let mut margin_total = BigDecimal::from(0);
        // v1.2.0: per-category commission accumulator
        let mut commission_total = BigDecimal::from(0);

        let order_id = Uuid::new_v4();

        // FR-13: 주문번호 UNIQUE 보장 (충돌 시 재시도, 최대 10회)
        let order_number = {
            let mut attempt = 0u32;
            loop {
                attempt += 1;
                let candidate = format!("P2-{}-{:05}", Utc::now().format("%Y%m%d"), rand_num());
                let exists = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = $1)",
                )
                .bind(&candidate)
                .fetch_one(&mut *tx)
                .await?;
                if !exists {
                    break candidate;
                }
                if attempt >= 10 {
                    return Err(AppError::Internal(anyhow::anyhow!(
                        "Failed to generate unique order number after 10 attempts"
                    )));
                }
            }
        };

        let mut order_items = Vec::new();
        // Collect item data first (calculate totals before INSERT)
        struct PendingItem {
            id: Uuid,
            product_id: Uuid,
            title: String,
            option_id: Option<Uuid>,
            opt_label: Option<String>,
            quantity: i32,
            unit_price: BigDecimal,
            item_subtotal: BigDecimal,
        }
        let mut pending_inserts = Vec::new();

        for SellerItemData {
            item,
            unit_price,
            shipping_fee,
            title,
            option_label: opt_label,
            margin_rate: item_margin_rate,
            commission_rate: item_commission_rate,
        } in items
        {
            let item_subtotal = unit_price * BigDecimal::from(item.quantity);
            subtotal += &item_subtotal;
            if shipping_fee > &max_shipping {
                max_shipping = shipping_fee.clone();
            }

            // FR-25+FR-20: margin_amount 실제 마진 금액으로 계산 (8자리 반올림)
            let item_margin = (unit_price * item_margin_rate / BigDecimal::from(100)
                * BigDecimal::from(item.quantity))
            .with_scale_round(8, bigdecimal::RoundingMode::HalfUp);
            margin_total += &item_margin;

            // v1.2.0: 거래수수료 = 판매가(unit_price) × commission_rate% × quantity
            // (사용자 정의: 판매금액에서 차감되는 수수료)
            let item_commission = (unit_price * item_commission_rate / BigDecimal::from(100)
                * BigDecimal::from(item.quantity))
            .with_scale_round(8, bigdecimal::RoundingMode::HalfUp);
            commission_total += &item_commission;

            order_items.push(OrderItemDetail {
                product_id: item.product_id,
                product_title: title.clone(),
                product_image: None,
                option_label: opt_label.clone(),
                quantity: item.quantity,
                unit_price: unit_price.clone(),
                subtotal: item_subtotal.clone(),
            });

            pending_inserts.push(PendingItem {
                id: Uuid::new_v4(),
                product_id: item.product_id,
                title: title.clone(),
                option_id: item.option_id,
                opt_label: opt_label.clone(),
                quantity: item.quantity,
                unit_price: unit_price.clone(),
                item_subtotal,
            });
        }

        let total_amount = &subtotal + &max_shipping;

        // Get seller name
        let seller_name = sqlx::query_scalar::<_, String>(
            "SELECT COALESCE(u.nickname, u.username) FROM seller_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = $1",
        )
        .bind(seller_id)
        .fetch_one(&mut *tx)
        .await?;

        // v1.2.0: 주문 단위 weighted commission_rate 계산
        // 하나의 주문에 카테고리가 다른 상품이 섞일 수 있어, 가중평균을 대표값으로 저장.
        // commission_amount는 위에서 누적된 정확한 합계 그대로 저장.
        let order_commission_rate = if subtotal > 0 {
            (&commission_total * BigDecimal::from(100) / &subtotal)
                .with_scale_round(2, bigdecimal::RoundingMode::HalfUp)
        } else {
            BigDecimal::from(0)
        };
        let order_net_profit = &margin_total - &commission_total;

        // INSERT orders FIRST (before order_items, due to foreign key)
        sqlx::query(
            r#"INSERT INTO orders (id, order_number, buyer_id, seller_id, recipient_name, recipient_phone, zipcode, address1, address2, shipping_memo,
                                   subtotal, shipping_fee, margin_amount, total_amount, company_wallet, payment_network, status,
                                   commission_rate, commission_amount, net_profit)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending_payment', $17, $18, $19)"#,
        )
        .bind(order_id)
        .bind(&order_number)
        .bind(auth.id)
        .bind(seller_id)
        .bind(&req.recipient_name)
        .bind(&req.recipient_phone)
        .bind(&req.zipcode)
        .bind(&req.address1)
        .bind(&req.address2)
        .bind(&req.shipping_memo)
        .bind(&subtotal)
        .bind(&max_shipping)
        .bind(&margin_total)
        .bind(&total_amount)
        .bind(&company_wallet)
        .bind(&req.payment_network)
        .bind(&order_commission_rate)
        .bind(&commission_total)
        .bind(&order_net_profit)
        .execute(&mut *tx)
        .await?;

        // THEN insert order_items
        for pi in &pending_inserts {
            sqlx::query(
                r#"INSERT INTO order_items (id, order_id, product_id, product_title, option_id, option_label, quantity, unit_price, subtotal)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
            )
            .bind(pi.id)
            .bind(order_id)
            .bind(pi.product_id)
            .bind(&pi.title)
            .bind(pi.option_id)
            .bind(&pi.opt_label)
            .bind(pi.quantity)
            .bind(&pi.unit_price)
            .bind(&pi.item_subtotal)
            .execute(&mut *tx)
            .await?;
        }

        created_orders.push(OrderCreatedItem {
            id: order_id,
            order_number,
            seller_name,
            total_amount,
            company_wallet: company_wallet.clone(),
            payment_network: req.payment_network.clone(),
            txid_deadline,
            items: order_items,
        });
    }

    // FR-03: 쿠폰 적용 (모든 주문 생성 후, 할인을 전 주문에 비례 배분)
    if let Some(coupon_id) = req.coupon_id {
        let claim = sqlx::query_as::<_, (Uuid,)>(
            r#"SELECT cc.id
               FROM user_coupons cc
               JOIN coupons c ON c.id = cc.coupon_id
               WHERE cc.coupon_id = $1 AND cc.user_id = $2
               AND cc.used_at IS NULL
               AND c.is_active = true
               AND (c.expires_at IS NULL OR c.expires_at > NOW())
               AND (c.starts_at IS NULL OR c.starts_at <= NOW())
               FOR UPDATE"#,
        )
        .bind(coupon_id)
        .bind(auth.id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Coupon not found, expired, or already used".into()))?;

        let coupon_info = sqlx::query_as::<_, (String, BigDecimal, Option<BigDecimal>)>(
            "SELECT discount_type, discount_value, min_order_amount FROM coupons WHERE id = $1",
        )
        .bind(coupon_id)
        .fetch_one(&mut *tx)
        .await?;

        let (discount_type, discount_value, min_order) = coupon_info;

        // FR-14: 카테고리별 쿠폰 타겟팅 검증 (check across all orders)
        let target_cats = sqlx::query_scalar::<_, Vec<Uuid>>(
            "SELECT COALESCE(target_categories, '{}') FROM coupons WHERE id = $1",
        )
        .bind(coupon_id)
        .fetch_one(&mut *tx)
        .await?;

        if !target_cats.is_empty() {
            for order in &created_orders {
                let order_cats = sqlx::query_scalar::<_, Uuid>(
                    r#"SELECT DISTINCT p.category_id FROM order_items oi
                       JOIN products p ON p.id = oi.product_id
                       WHERE oi.order_id = $1"#,
                )
                .bind(order.id)
                .fetch_all(&mut *tx)
                .await?;

                let all_match = order_cats.iter().all(|cat| target_cats.contains(cat));
                if !all_match {
                    return Err(AppError::Validation {
                        message: "쿠폰 적용 대상 카테고리가 아닙니다".into(),
                        field: Some("coupon_id".into()),
                    });
                }
            }
        }

        // 최소 주문금액 검증 (전체 주문 합산 기준)
        let grand_total: BigDecimal = created_orders
            .iter()
            .map(|o| &o.total_amount)
            .fold(BigDecimal::from(0), |acc, a| acc + a);

        if let Some(ref min) = min_order {
            if &grand_total < min {
                return Err(AppError::Validation {
                    message: format!("Minimum order amount for this coupon is {}", min),
                    field: Some("coupon_id".into()),
                });
            }
        }

        // FR-03: 쿠폰 할인 금액 계산
        let discount_amount = match discount_type.as_str() {
            "fixed" => discount_value.clone(),
            "percent" => {
                let raw = (&grand_total * &discount_value / BigDecimal::from(100))
                    .with_scale_round(8, bigdecimal::RoundingMode::HalfUp);
                let max_discount = sqlx::query_scalar::<_, Option<BigDecimal>>(
                    "SELECT max_discount FROM coupons WHERE id = $1",
                )
                .bind(coupon_id)
                .fetch_one(&mut *tx)
                .await?;
                match max_discount {
                    Some(max_d) if raw > max_d => max_d,
                    _ => raw,
                }
            }
            _ => BigDecimal::from(0),
        };

        // 할인 금액이 전체 주문 금액을 초과하지 않도록
        let discount_amount = if discount_amount > grand_total {
            grand_total.clone()
        } else {
            discount_amount
        };

        // 비례 배분: 각 주문의 total_amount 비율에 따라 할인 분배
        if grand_total > 0 && discount_amount > 0 {
            let mut distributed_total = BigDecimal::from(0);
            let order_count = created_orders.len();

            for (idx, order) in created_orders.iter_mut().enumerate() {
                // 마지막 주문은 나머지를 할당 (반올림 오차 방지)
                let order_discount = if idx == order_count - 1 {
                    &discount_amount - &distributed_total
                } else {
                    (&order.total_amount * &discount_amount / &grand_total)
                        .with_scale_round(8, bigdecimal::RoundingMode::HalfUp)
                };

                // 개별 주문 할인이 주문 금액을 초과하지 않도록
                let order_discount = if order_discount > order.total_amount {
                    order.total_amount.clone()
                } else {
                    order_discount
                };

                distributed_total += &order_discount;

                let new_total = &order.total_amount - &order_discount;
                sqlx::query(
                    "UPDATE orders SET total_amount = $1, discount_amount = $2, updated_at = NOW() WHERE id = $3",
                )
                .bind(&new_total)
                .bind(&order_discount)
                .bind(order.id)
                .execute(&mut *tx)
                .await?;

                order.total_amount = new_total;
            }
        }

        // used_at 갱신
        sqlx::query("UPDATE user_coupons SET used_at = NOW() WHERE id = $1")
            .bind(claim.0)
            .execute(&mut *tx)
            .await?;

        // used_count 증가
        sqlx::query("UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE id = $1")
            .bind(coupon_id)
            .execute(&mut *tx)
            .await?;
    }

    // FR-26: Remove ordered items from cart (batch delete)
    let cart_product_ids: Vec<Uuid> = req.items.iter().map(|i| i.product_id).collect();
    sqlx::query("DELETE FROM cart_items WHERE user_id = $1 AND product_id = ANY($2)")
        .bind(auth.id)
        .bind(&cart_product_ids)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    // Queue order confirmation emails (after commit, non-blocking)
    for order in &created_orders {
        let _ = crate::domain::email::queue_email(
            &state.db,
            auth.id,
            crate::domain::email::EmailTemplate::OrderConfirmed {
                order_number: order.order_number.clone(),
                total: order.total_amount.to_string(),
            },
        )
        .await;
    }

    Ok(Json(OrderCreatedResponse {
        data: OrderCreatedData {
            orders: created_orders,
        },
    }))
}

/// FR-04: Buyer order list with status/date/search filters
#[derive(Debug, serde::Deserialize)]
pub struct BuyerOrderQueryParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub search: Option<String>,
}

async fn list_orders(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<BuyerOrderQueryParams>,
) -> Result<Json<OrderListResponse>, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;
    let status_filter = params.status.as_deref();
    let date_from = params.date_from.as_deref();
    let date_to = params.date_to.as_deref();
    let search = params.search.as_deref().map(escape_like);
    let search_ref = search.as_deref();

    // Use COUNT(*) OVER() to eliminate separate count query
    let orders = sqlx::query_as::<_, OrderSummary>(
        r#"SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
                  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
                  (SELECT product_title FROM order_items WHERE order_id = o.id LIMIT 1) as first_item_title,
                  (SELECT pi.image_url FROM order_items oi
                   JOIN product_images pi ON pi.product_id = oi.product_id AND pi.is_main = true
                   WHERE oi.order_id = o.id LIMIT 1) as first_item_image,
                  COUNT(*) OVER() as total_count
           FROM orders o
           WHERE o.buyer_id = $1
             AND ($2::text IS NULL OR o.status = $2)
             AND ($5::text IS NULL OR o.created_at::date >= $5::date)
             AND ($6::text IS NULL OR o.created_at::date <= $6::date)
             AND ($7::text IS NULL OR o.order_number ILIKE '%' || $7 || '%'
                  OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_title ILIKE '%' || $7 || '%'))
           ORDER BY o.created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(auth.id)
    .bind(status_filter)
    .bind(per_page)
    .bind(offset)
    .bind(date_from)
    .bind(date_to)
    .bind(search_ref)
    .fetch_all(&state.db)
    .await?;

    let total = orders.first().and_then(|o| o.total_count).unwrap_or(0);

    Ok(Json(OrderListResponse {
        data: orders,
        pagination: crate::domain::common::Pagination::new(page, per_page, total),
    }))
}

/// FR-07: 구매 확정 (delivered → confirmed)
async fn confirm_order(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;

    let order = sqlx::query_as::<_, (Uuid, Uuid, OrderStatus)>(
        "SELECT buyer_id, seller_id, status FROM orders WHERE id = $1 FOR UPDATE",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("주문을 찾을 수 없습니다".into()))?;

    let (buyer_id, _seller_id, status) = order;

    if buyer_id != auth.id {
        return Err(AppError::Forbidden(
            "본인의 주문만 확정할 수 있습니다".into(),
        ));
    }
    if status != OrderStatus::Delivered {
        return Err(AppError::Validation {
            message: "배송 완료 상태에서만 구매 확정이 가능합니다".into(),
            field: Some("status".into()),
        });
    }

    // Audit Concurrency C-2 (2026-05-07): refund_blocked 를 confirm 트랜잭션 안에서
    // 즉시 TRUE 로 설정. 이전엔 UDG webhook 비동기 처리 후 set 이라 narrow window
    // 에 환불 요청이 slip 가능 (확정 → webhook 사이). webhook 은 단순히 멱등성을
    // 위해 다시 TRUE 로 set 만 함 (idempotent).
    sqlx::query(
        "UPDATE orders SET status = 'confirmed', confirmed_at = NOW(), refund_blocked = TRUE, updated_at = NOW() WHERE id = $1",
    )
    .bind(order_id)
    .execute(&mut *tx)
    .await?;

    // Platform revenue ledger: capture confirmed commission as a snapshot row so future
    // refunds/cancellations don't silently change historical platform-revenue SUMs and
    // we have an auditable record of "when did this commission become company income."
    // Idempotent via NOT EXISTS guard (defense-in-depth; status check above already
    // prevents a second invocation).
    // Round 6a (C3): order_commission_logs.seller_id 가 seller_profiles(id) 참조.
    // sp.id 를 직접 사용 (이전엔 sp.user_id 였음).
    sqlx::query(
        r#"INSERT INTO order_commission_logs
               (order_id, seller_id, entry_type, order_amount, commission_rate, commission_amount, net_amount)
           SELECT o.id,
                  sp.id,
                  'confirmed_revenue',
                  o.total_amount,
                  COALESCE(o.commission_rate, 0),
                  COALESCE(o.commission_amount, 0),
                  o.total_amount - COALESCE(o.commission_amount, 0)
           FROM orders o
           JOIN seller_profiles sp ON sp.id = o.seller_id
           WHERE o.id = $1
             AND NOT EXISTS (
                 SELECT 1 FROM order_commission_logs
                 WHERE order_id = $1 AND entry_type = 'confirmed_revenue'
             )"#,
    )
    .bind(order_id)
    .execute(&mut *tx)
    .await?;

    // Archive chat room
    sqlx::query(
        "UPDATE chat_rooms SET status = 'archived' WHERE order_id = $1 AND status = 'active'",
    )
    .bind(order_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // UDG webhook enqueue + 즉시 dispatch.
    // 이전엔 `let _ = enqueue(...).await` 만 호출해서 (1) enqueue 자체가 실패해도
    // 사일런트로 무시되고 (2) 큐에 들어가도 scheduler 의 1분 주기를 기다려야 해서
    // 구매확정 직후 udg 분배가 즉시 이뤄지지 않는 문제가 있었음.
    // user.registered / user.updated 와 같은 패턴으로 통일.
    if let Err(e) = crate::domain::udg::enqueue_udg_order_confirmed(&state.db, order_id).await {
        tracing::error!(
            "Failed to enqueue UDG order.confirmed for order {}: {}",
            order_id,
            e
        );
    } else {
        let state_bg = state.clone();
        tokio::spawn(async move {
            if let Err(e) = crate::scheduler::webhook::process_webhook_queue(&state_bg).await {
                tracing::warn!(
                    "Immediate webhook dispatch (order.confirmed) failed, scheduler will retry: {}",
                    e
                );
            }
        });
    }

    Ok(Json(serde_json::json!({
        "data": {
            "message": "구매가 확정되었습니다.",
            "order_id": order_id,
            "status": "confirmed"
        }
    })))
}

/// FR-13: 주문 취소 (pending_payment → cancelled + 재고 복원)
async fn cancel_order(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;

    let order = sqlx::query_as::<_, (Uuid, OrderStatus)>(
        "SELECT buyer_id, status FROM orders WHERE id = $1 FOR UPDATE",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("주문을 찾을 수 없습니다".into()))?;

    let (buyer_id, status) = order;

    if buyer_id != auth.id {
        return Err(AppError::Forbidden(
            "본인의 주문만 취소할 수 있습니다".into(),
        ));
    }
    if status != OrderStatus::PendingPayment {
        return Err(AppError::Validation {
            message: "결제 대기 상태에서만 취소가 가능합니다".into(),
            field: Some("status".into()),
        });
    }

    sqlx::query(
        "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'buyer_cancelled', updated_at = NOW() WHERE id = $1",
    )
    .bind(order_id)
    .execute(&mut *tx)
    .await?;

    // Restore stock
    restore_stock_tx(&mut tx, order_id).await?;

    // Archive chat room (if exists)
    sqlx::query(
        "UPDATE chat_rooms SET status = 'archived' WHERE order_id = $1 AND status = 'active'",
    )
    .bind(order_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "data": {
            "message": "주문이 취소되었습니다.",
            "order_id": order_id,
            "status": "cancelled"
        }
    })))
}

async fn get_order(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let order = sqlx::query_as::<_, Order>("SELECT * FROM orders WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    // Verify buyer or seller
    if order.buyer_id != auth.id {
        let is_seller = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM seller_profiles WHERE id = $1 AND user_id = $2)",
        )
        .bind(order.seller_id)
        .bind(auth.id)
        .fetch_one(&state.db)
        .await?;

        if !is_seller {
            return Err(AppError::Forbidden(
                "Not authorized to view this order".into(),
            ));
        }
    }

    let items = sqlx::query_as::<_, OrderItem>("SELECT * FROM order_items WHERE order_id = $1")
        .bind(id)
        .fetch_all(&state.db)
        .await?;

    let txid = sqlx::query_scalar::<_, String>("SELECT txid FROM transactions WHERE order_id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?;

    let seller_name = sqlx::query_scalar::<_, String>(
        "SELECT COALESCE(u.nickname, u.username) FROM seller_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = $1",
    )
    .bind(order.seller_id)
    .fetch_one(&state.db)
    .await?;

    // Build timeline
    let mut timeline = vec![OrderEvent {
        status: "created".into(),
        label: "주문 생성".into(),
        timestamp: order.created_at.unwrap_or_else(Utc::now),
    }];

    if txid.is_some() {
        let tx = sqlx::query_as::<_, Transaction>("SELECT * FROM transactions WHERE order_id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?;
        if let Some(t) = tx {
            timeline.push(OrderEvent {
                status: "txid_submitted".into(),
                label: "TXID 제출".into(),
                timestamp: t.submitted_at.unwrap_or_else(Utc::now),
            });
        }
    }

    if order.status == OrderStatus::Cancelled {
        if let Some(at) = order.cancelled_at {
            timeline.push(OrderEvent {
                status: "cancelled".into(),
                label: "주문 취소".into(),
                timestamp: at,
            });
        }
    }

    let item_details: Vec<OrderItemDetail> = items
        .into_iter()
        .map(|i| OrderItemDetail {
            product_id: i.product_id,
            product_title: i.product_title,
            product_image: None,
            option_label: i.option_label,
            quantity: i.quantity,
            unit_price: i.unit_price,
            subtotal: i.subtotal,
        })
        .collect();

    let txid_deadline = order.created_at.map(|c| c + Duration::hours(24));

    // v1.3.6: 주문 내 모든 아이템이 디지털 카테고리이면 is_digital=true.
    // 비디지털이 하나라도 섞여 있으면 false (일반 운송장 흐름 사용).
    let is_digital = sqlx::query_scalar::<_, bool>(
        r#"SELECT COALESCE(BOOL_AND(c.is_digital), false)
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           JOIN categories c ON c.id = p.category_id
           WHERE oi.order_id = $1"#,
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    let detail = OrderDetail {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        seller_name,
        recipient_name: order.recipient_name,
        recipient_phone: order.recipient_phone,
        zipcode: order.zipcode,
        address1: order.address1,
        address2: order.address2,
        shipping_memo: order.shipping_memo,
        items: item_details,
        subtotal: order.subtotal,
        shipping_fee: order.shipping_fee,
        margin_amount: order.margin_amount,
        total_amount: order.total_amount,
        company_wallet: order.company_wallet,
        payment_network: order.payment_network,
        txid,
        timeline,
        txid_deadline,
        created_at: order.created_at,
        is_digital,
    };

    Ok(Json(serde_json::json!({ "data": detail })))
}

/// PUT /orders/{id}/network — 결제 전 네트워크 변경
async fn update_payment_network(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
    Json(req): Json<UpdateNetworkRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if !["ERC-20", "TRC-20", "BEP-20"].contains(&req.payment_network.as_str()) {
        return Err(AppError::Validation {
            message: "payment_network must be one of: ERC-20, TRC-20, BEP-20".into(),
            field: Some("payment_network".into()),
        });
    }

    // Only the buyer can change, and only before payment
    let order =
        sqlx::query_as::<_, (Uuid, String)>("SELECT buyer_id, status FROM orders WHERE id = $1")
            .bind(order_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    if order.0 != auth.id {
        return Err(AppError::Forbidden("Not your order".into()));
    }
    if order.1 != "pending_payment" {
        return Err(AppError::Validation {
            message: "Cannot change network after payment".into(),
            field: Some("status".into()),
        });
    }

    // Resolve wallet address for the selected network
    let settings_key = match req.payment_network.as_str() {
        "TRC-20" => "company_wallet_tron",
        "ERC-20" => "company_wallet_eth",
        _ => "company_wallet_address",
    };
    let env_fallback = match req.payment_network.as_str() {
        "TRC-20" => &state.config.company_wallet_tron,
        "ERC-20" => &state.config.company_wallet_eth,
        _ => &state.config.company_wallet_address,
    };

    let db_wallet: Option<String> =
        sqlx::query_scalar("SELECT value FROM system_settings WHERE key = $1")
            .bind(settings_key)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

    let wallet = db_wallet
        .filter(|w| !w.trim().is_empty())
        .unwrap_or_else(|| env_fallback.clone());

    if wallet.is_empty() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Wallet not configured for {}",
            req.payment_network
        )));
    }

    sqlx::query("UPDATE orders SET payment_network = $1, company_wallet = $2, updated_at = NOW() WHERE id = $3")
        .bind(&req.payment_network)
        .bind(&wallet)
        .bind(order_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({
        "data": {
            "payment_network": req.payment_network,
            "company_wallet": wallet
        }
    })))
}

async fn submit_txid(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
    Json(req): Json<SubmitTxidRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-20: User-keyed rate limit (3/min per user)
    crate::middleware::rate_limit::check_user_rate_limit(&state.user_rate_limiters.txid, auth.id)?;

    // Validate TXID format: ERC-20 (0x + 64 hex) or TRC-20 (64 hex)
    let is_erc20 = req.txid.len() == 66
        && req.txid.starts_with("0x")
        && req.txid[2..].chars().all(|c| c.is_ascii_hexdigit());
    let is_trc20 = req.txid.len() == 64 && req.txid.chars().all(|c| c.is_ascii_hexdigit());

    if !is_erc20 && !is_trc20 {
        return Err(AppError::Validation {
            message: "Invalid TXID format. Expected 0x + 64 hex (ERC-20) or 64 hex (TRC-20)".into(),
            field: Some("txid".into()),
        });
    }

    // FR-01: 전체 submit_txid 로직을 단일 트랜잭션 내에서 처리 (TOCTOU 방지)
    let network = crate::domain::txid_verifier::TxidVerifier::detect_network(&req.txid)
        .map(|n| n.as_str().to_string())
        .unwrap_or_else(|| "unknown".into());

    let tx_id = Uuid::new_v4();

    let mut db_tx = state.db.begin().await?;

    // FR-01: SELECT FOR UPDATE로 주문 잠금
    let order = sqlx::query_as::<_, Order>(
        "SELECT * FROM orders WHERE id = $1 AND buyer_id = $2 FOR UPDATE",
    )
    .bind(order_id)
    .bind(auth.id)
    .fetch_optional(&mut *db_tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    if order.status != OrderStatus::PendingPayment {
        return Err(AppError::Validation {
            message: "Order is not in pending payment status".into(),
            field: Some("status".into()),
        });
    }

    // Check 24h deadline
    if let Some(created) = order.created_at {
        if Utc::now() > created + Duration::hours(24) {
            // FR-27: 타임아웃 취소 + 재고 복원을 단일 트랜잭션으로 처리
            sqlx::query("UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'TXID timeout' WHERE id = $1")
                .bind(order_id)
                .execute(&mut *db_tx)
                .await?;
            restore_stock_tx(&mut db_tx, order_id).await?;
            db_tx.commit().await?;
            return Err(AppError::Validation {
                message: "Payment deadline has expired. Order cancelled.".into(),
                field: Some("txid".into()),
            });
        }
    }

    // FR-01: 같은 주문에 이미 TXID가 제출되었는지 체크
    let has_existing_txid = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM transactions WHERE order_id = $1)",
    )
    .bind(order_id)
    .fetch_one(&mut *db_tx)
    .await?;

    if has_existing_txid {
        return Err(AppError::Conflict(
            "TXID already submitted for this order".into(),
        ));
    }

    // TXID 전역 중복 체크
    let existing_txid =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM transactions WHERE txid = $1 FOR UPDATE")
            .bind(&req.txid)
            .fetch_optional(&mut *db_tx)
            .await?;

    if existing_txid.is_some() {
        return Err(AppError::Conflict("This TXID has already been used".into()));
    }

    // Audit M1 (2026-05-07): EXISTS 체크와 INSERT 사이 race 로 다른 트랜잭션이
    // 같은 TXID 를 INSERT 하면 unique constraint 위반 → 23505 → 사용자 친화 메시지.
    sqlx::query(
        r#"INSERT INTO transactions (id, order_id, txid, network, verification_status, submitted_at)
           VALUES ($1, $2, $3, $4, 'pending', NOW())"#,
    )
    .bind(tx_id)
    .bind(order_id)
    .bind(&req.txid)
    .bind(&network)
    .execute(&mut *db_tx)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23505") {
                return AppError::Conflict("This TXID has already been used".into());
            }
        }
        AppError::Database(e)
    })?;

    // FR-16: txid_submitted → verifying 중간 상태 추가
    sqlx::query("UPDATE orders SET status = 'verifying', updated_at = NOW() WHERE id = $1")
        .bind(order_id)
        .execute(&mut *db_tx)
        .await?;

    db_tx.commit().await?;

    // Run TXID auto-verification asynchronously
    let verifier = crate::domain::txid_verifier::TxidVerifier::new(
        state.config.etherscan_api_key.clone(),
        state.config.trongrid_api_key.clone(),
        state.config.company_wallet_eth.clone(),
        state.config.company_wallet_tron.clone(),
    );
    let txid_clone = req.txid.clone();
    let order_total = order.total_amount.clone();
    let order_created = order.created_at.unwrap_or_else(Utc::now);
    let db = state.db.clone();
    let ws_hub = state.ws_hub.clone();
    let buyer_id = auth.id;

    // CRIT-11: Add error tracking to spawned TXID verification task
    // C-2 FIX: Wrap verification result update + order status change in a single transaction
    tokio::spawn(async move {
        let result = verifier
            .verify(&txid_clone, &order_total, order_created, &db)
            .await;

        // Use a DB transaction to ensure atomic update of transaction + order status
        let tx_result: Result<bool, sqlx::Error> = async {
            let mut dbtx = db.begin().await?;

            // Update transaction with verification result
            sqlx::query(
                r#"UPDATE transactions
                   SET verification_status = $1,
                       from_address = $2,
                       to_address = $3,
                       amount = $4,
                       failure_reason = $5
                   WHERE id = $6"#,
            )
            .bind(if result.passed { "verified" } else { "failed" })
            .bind(&result.from_address)
            .bind(&result.to_address)
            .bind(&result.amount)
            .bind(&result.failure_reason)
            .bind(tx_id)
            .execute(&mut *dbtx)
            .await?;

            if result.passed {
                // Auto-approve: update order status atomically within same transaction
                sqlx::query(
                    "UPDATE orders SET status = 'payment_verified', updated_at = NOW() WHERE id = $1 AND status = 'verifying'",
                )
                .bind(order_id)
                .execute(&mut *dbtx)
                .await?;
            }

            dbtx.commit().await?;
            Ok(result.passed)
        }.await;

        match tx_result {
            Ok(true) => {
                let _ = crate::domain::notification::create_notification(
                    &db,
                    Some(&ws_hub),
                    buyer_id,
                    "payment",
                    "결제 확인 완료",
                    "TXID 자동 검증이 완료되어 결제가 승인되었습니다.",
                    Some(&format!("/orders/{}", order_id)),
                )
                .await;
            }
            Ok(false) => {
                // Notify admin for manual verification
                tracing::warn!(
                    "TXID auto-verification failed for order {}: {:?}",
                    order_id,
                    result.failure_reason
                );

                let admin_ids = sqlx::query_scalar::<_, uuid::Uuid>(
                    "SELECT id FROM users WHERE role = 'admin'",
                )
                .fetch_all(&db)
                .await
                .unwrap_or_default();

                let msg = format!(
                    "TXID 자동 검증 실패 - 수동 확인 필요. 주문 ID: {}. 사유: {}",
                    order_id,
                    result.failure_reason.as_deref().unwrap_or("알 수 없음")
                );
                for admin_id in admin_ids {
                    let _ = crate::domain::notification::create_notification(
                        &db,
                        Some(&ws_hub),
                        admin_id,
                        "payment",
                        "TXID 수동 검증 필요",
                        &msg,
                        Some("/admin/txid"),
                    )
                    .await;
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed TXID verification DB transaction for order {}: {:?}",
                    order_id,
                    e
                );
                sentry::capture_message(
                    &format!(
                        "TXID verification DB transaction failed: order={}, err={:?}",
                        order_id, e
                    ),
                    sentry::Level::Error,
                );
            }
        }
    });

    Ok(Json(serde_json::json!({
        "data": {
            "order_id": order_id,
            "txid": req.txid,
            "status": "verifying",
            "network": network,
            "message": "TXID가 접수되었습니다. 자동 검증 진행 중입니다."
        }
    })))
}

#[derive(Debug, serde::Deserialize)]
pub struct SellerOrderQueryParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    /// Filter by date range (YYYY-MM-DD)
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

async fn seller_orders(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<SellerOrderQueryParams>,
) -> Result<Json<SellerOrderListResponse>, AppError> {
    // Allow suspended sellers (role downgraded) to view orders
    let seller_id =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::Forbidden("Seller profile not found".into()))?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;
    let status_filter = params.status.as_deref();
    let date_from = params.date_from.as_deref();
    let date_to = params.date_to.as_deref();

    // Use COUNT(*) OVER() to eliminate separate count query
    let orders = sqlx::query_as::<_, SellerOrderSummary>(
        r#"SELECT o.id, o.order_number, o.status,
                  o.total_amount, o.subtotal, o.shipping_fee, o.margin_amount,
                  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
                  (SELECT product_title FROM order_items WHERE order_id = o.id LIMIT 1) as first_item_title,
                  NULL::text as first_item_image,
                  u.nickname as buyer_nickname,
                  o.recipient_name, o.recipient_phone,
                  t.txid, t.verification_status,
                  dt.carrier_name, dt.tracking_number,
                  o.shipped_at, o.delivered_at, o.auto_confirm_at, o.confirmed_at,
                  o.created_at, o.updated_at,
                  COUNT(*) OVER() as total_count
           FROM orders o
           JOIN users u ON u.id = o.buyer_id
           LEFT JOIN transactions t ON t.order_id = o.id
           LEFT JOIN delivery_trackings dt ON dt.order_id = o.id
           WHERE o.seller_id = $1
             AND ($2::text IS NULL OR o.status = $2)
             AND ($5::text IS NULL OR o.created_at::date >= $5::date)
             AND ($6::text IS NULL OR o.created_at::date <= $6::date)
           ORDER BY o.created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(seller_id)
    .bind(status_filter)
    .bind(per_page)
    .bind(offset)
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&state.db)
    .await?;

    let total = orders.first().and_then(|o| o.total_count).unwrap_or(0);

    Ok(Json(SellerOrderListResponse {
        data: orders,
        pagination: crate::domain::common::Pagination::new(page, per_page, total),
    }))
}

fn rand_num() -> u32 {
    use rand::Rng;
    rand::thread_rng().gen_range(0..100000)
}

/// Escape SQL LIKE/ILIKE wildcards (%, _, \) by prefixing them with \.
fn escape_like(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '%' | '_' | '\\' => {
                out.push('\\');
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    out
}
