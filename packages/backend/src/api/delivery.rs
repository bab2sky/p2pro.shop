use axum::{
    extract::{Path, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::domain::order::OrderStatus;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Buyer routes for delivery tracking
pub fn buyer_router() -> Router<AppState> {
    Router::new().route("/orders/{id}/delivery", get(get_delivery_tracking))
}

/// Seller routes for registering shipping
pub fn seller_router() -> Router<AppState> {
    Router::new()
        .route("/orders/{id}/shipping", post(register_shipping))
        .route("/orders/bulk-shipping", post(bulk_register_shipping))
        .route(
            "/orders/{id}/digital-delivery",
            post(complete_digital_delivery),
        )
}

#[derive(serde::Deserialize)]
struct RegisterShippingRequest {
    carrier_code: String,
    carrier_name: String,
    tracking_number: String,
}

async fn register_shipping(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
    Json(req): Json<RegisterShippingRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify order belongs to this seller and is in correct status
    let order = sqlx::query_as::<_, (Uuid, OrderStatus, Uuid)>(
        r#"SELECT o.id, o.status, sp.user_id
           FROM orders o
           JOIN seller_profiles sp ON sp.id = o.seller_id
           WHERE o.id = $1"#,
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    if order.2 != auth.id {
        return Err(AppError::Forbidden("Not your order".into()));
    }

    if order.1 != OrderStatus::PaymentVerified {
        return Err(AppError::Validation {
            message: "Order must be in payment_verified status to register shipping".into(),
            field: None,
        });
    }

    // FR-08: 트랜잭션으로 tracking INSERT + order UPDATE 원자적 처리
    let tracking_id = Uuid::new_v4();
    let mut tx = state.db.begin().await?;

    sqlx::query(
        r#"INSERT INTO delivery_trackings (id, order_id, carrier_code, carrier_name, tracking_number)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (order_id) DO UPDATE SET
               carrier_code = EXCLUDED.carrier_code,
               carrier_name = EXCLUDED.carrier_name,
               tracking_number = EXCLUDED.tracking_number,
               status = 'in_transit',
               updated_at = NOW()"#,
    )
    .bind(tracking_id)
    .bind(order_id)
    .bind(&req.carrier_code)
    .bind(&req.carrier_name)
    .bind(&req.tracking_number)
    .execute(&mut *tx)
    .await?;

    // Update order status to 'shipped' (rows_affected 체크)
    let ship_result = sqlx::query("UPDATE orders SET status = 'shipped', shipped_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'payment_verified'")
        .bind(order_id)
        .execute(&mut *tx)
        .await?;

    if ship_result.rows_affected() == 0 {
        return Err(AppError::Validation {
            message: "Order status change failed (not in payment_verified)".into(),
            field: None,
        });
    }

    // Notify buyer
    let buyer_id = sqlx::query_scalar::<_, Uuid>("SELECT buyer_id FROM orders WHERE id = $1")
        .bind(order_id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    let _ = crate::domain::notification::create_notification(
        &state.db,
        Some(&state.ws_hub),
        buyer_id,
        "delivery",
        "상품 발송",
        &format!(
            "주문하신 상품이 발송되었습니다. 택배사: {}, 운송장: {}",
            req.carrier_name, req.tracking_number
        ),
        Some(&format!("/orders/{}", order_id)),
    )
    .await;

    Ok(Json(json!({
        "data": {
            "tracking_id": tracking_id,
            "order_id": order_id,
            "carrier_name": req.carrier_name,
            "tracking_number": req.tracking_number,
            "status": "in_transit",
        }
    })))
}

#[derive(serde::Deserialize)]
struct BulkShippingItem {
    order_id: Uuid,
    carrier_code: String,
    carrier_name: String,
    tracking_number: String,
}

#[derive(serde::Deserialize)]
struct BulkShippingRequest {
    items: Vec<BulkShippingItem>,
}

async fn bulk_register_shipping(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<BulkShippingRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.items.is_empty() || req.items.len() > 100 {
        return Err(AppError::Validation {
            message: "Items must be between 1 and 100".into(),
            field: Some("items".into()),
        });
    }

    let mut errors = Vec::new();
    let mut success = 0usize;

    for (row_idx, item) in req.items.iter().enumerate() {
        let row = row_idx + 2; // +2: 1-indexed + header row
                               // Verify order belongs to this seller
        let order = sqlx::query_as::<_, (OrderStatus, Uuid)>(
            r#"SELECT o.status, sp.user_id
               FROM orders o
               JOIN seller_profiles sp ON sp.id = o.seller_id
               WHERE o.id = $1"#,
        )
        .bind(item.order_id)
        .fetch_optional(&state.db)
        .await?;

        match order {
            None => {
                errors.push(json!({
                    "row": row,
                    "order_id": item.order_id,
                    "reason": "Order not found",
                }));
            }
            Some((status, seller_user_id)) => {
                if seller_user_id != auth.id {
                    errors.push(json!({
                        "row": row,
                        "order_id": item.order_id,
                        "reason": "Not your order",
                    }));
                    continue;
                }
                if status != OrderStatus::PaymentVerified {
                    errors.push(json!({
                        "row": row,
                        "order_id": item.order_id,
                        "reason": format!("Order status is not payment_verified (current: {})", status),
                    }));
                    continue;
                }

                // FR-28: 개별 트랜잭션 + carrier_code/carrier_name 올바르게 바인딩
                let tracking_id = Uuid::new_v4();
                let mut item_tx = state.db.begin().await?;

                sqlx::query(
                    r#"INSERT INTO delivery_trackings (id, order_id, carrier_code, carrier_name, tracking_number)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT (order_id) DO UPDATE SET
                           carrier_code = EXCLUDED.carrier_code,
                           carrier_name = EXCLUDED.carrier_name,
                           tracking_number = EXCLUDED.tracking_number,
                           status = 'in_transit',
                           updated_at = NOW()"#,
                )
                .bind(tracking_id)
                .bind(item.order_id)
                .bind(&item.carrier_code)
                .bind(&item.carrier_name)
                .bind(&item.tracking_number)
                .execute(&mut *item_tx)
                .await?;

                let ship_result = sqlx::query("UPDATE orders SET status = 'shipped', shipped_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'payment_verified'")
                    .bind(item.order_id)
                    .execute(&mut *item_tx)
                    .await?;

                if ship_result.rows_affected() == 0 {
                    errors.push(json!({
                        "row": row,
                        "order_id": item.order_id,
                        "reason": "Failed to update order status",
                    }));
                    // rollback by dropping item_tx
                    continue;
                }

                item_tx.commit().await?;

                // Notify buyer
                if let Ok(buyer_id) =
                    sqlx::query_scalar::<_, Uuid>("SELECT buyer_id FROM orders WHERE id = $1")
                        .bind(item.order_id)
                        .fetch_one(&state.db)
                        .await
                {
                    let _ = crate::domain::notification::create_notification(
                        &state.db,
                        Some(&state.ws_hub),
                        buyer_id,
                        "delivery",
                        "상품 발송",
                        &format!(
                            "주문하신 상품이 발송되었습니다. 택배사: {}, 운송장: {}",
                            item.carrier_name, item.tracking_number
                        ),
                        Some(&format!("/orders/{}", item.order_id)),
                    )
                    .await;
                }

                success += 1;
            }
        }
    }

    let failed = errors.len();

    Ok(Json(json!({
        "data": {
            "total": req.items.len(),
            "success": success,
            "failed": failed,
            "errors": errors,
        }
    })))
}

async fn get_delivery_tracking(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify user is buyer or seller of this order
    let is_participant = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
            SELECT 1 FROM orders o
            LEFT JOIN seller_profiles sp ON sp.id = o.seller_id
            WHERE o.id = $1 AND (o.buyer_id = $2 OR sp.user_id = $2)
        )"#,
    )
    .bind(order_id)
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if !is_participant {
        return Err(AppError::Forbidden(
            "Not authorized to view this tracking".into(),
        ));
    }

    let tracking = sqlx::query_as::<_, (String, String, String, Option<String>, Option<chrono::DateTime<chrono::Utc>>, serde_json::Value, Option<chrono::DateTime<chrono::Utc>>)>(
        r#"SELECT carrier_name, tracking_number, status, last_detail, estimated_delivery, tracking_events, delivered_at
           FROM delivery_trackings WHERE order_id = $1"#,
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("No delivery tracking found for this order".into()))?;

    Ok(Json(json!({
        "data": {
            "carrier_name": tracking.0,
            "tracking_number": tracking.1,
            "status": tracking.2,
            "last_detail": tracking.3,
            "estimated_delivery": tracking.4,
            "events": tracking.5,
            "delivered_at": tracking.6,
        }
    })))
}

/// v1.3.6: 디지털 상품 즉시 전송 완료 처리.
/// 셀러가 NFT/소프트웨어 등 디지털 자산을 구매자에게 전달한 뒤 한 번 클릭으로
/// payment_verified → delivered 로 전환. 운송장 입력 불필요.
/// 이후 buyer 가 구매확정(혹은 7일 자동확정) 시 정상 UDG 분배 흐름이 진행된다.
async fn complete_digital_delivery(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // 1) 셀러 소유 + 현재 상태 확인
    let order = sqlx::query_as::<_, (Uuid, OrderStatus, Uuid)>(
        r#"SELECT o.id, o.status, sp.user_id
           FROM orders o
           JOIN seller_profiles sp ON sp.id = o.seller_id
           WHERE o.id = $1"#,
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Order not found".into()))?;

    if order.2 != auth.id {
        return Err(AppError::Forbidden("Not your order".into()));
    }
    if order.1 != OrderStatus::PaymentVerified {
        return Err(AppError::Validation {
            message: "Order must be in payment_verified status to complete digital delivery".into(),
            field: None,
        });
    }

    // 2) 주문 내 모든 아이템이 디지털 카테고리인지 확인.
    //    하나라도 비디지털이 섞여 있으면 일반 운송장 흐름을 사용해야 안전함.
    let any_physical = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
              SELECT 1 FROM order_items oi
              JOIN products p ON p.id = oi.product_id
              JOIN categories c ON c.id = p.category_id
              WHERE oi.order_id = $1 AND c.is_digital = false
           )"#,
    )
    .bind(order_id)
    .fetch_one(&state.db)
    .await?;
    if any_physical {
        return Err(AppError::Validation {
            message: "Order contains non-digital items. Use standard shipping flow.".into(),
            field: None,
        });
    }

    // 3) 단일 트랜잭션으로 shipped 단계를 건너뛰고 바로 delivered 로 전환.
    let mut tx = state.db.begin().await?;
    let updated = sqlx::query(
        "UPDATE orders SET status = 'delivered', shipped_at = NOW(), delivered_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'payment_verified'",
    )
    .bind(order_id)
    .execute(&mut *tx)
    .await?;

    if updated.rows_affected() == 0 {
        return Err(AppError::Validation {
            message: "Order status changed concurrently. Refresh and try again.".into(),
            field: None,
        });
    }

    let buyer_id = sqlx::query_scalar::<_, Uuid>("SELECT buyer_id FROM orders WHERE id = $1")
        .bind(order_id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    let _ = crate::domain::notification::create_notification(
        &state.db,
        Some(&state.ws_hub),
        buyer_id,
        "delivery",
        "디지털 상품 전송 완료",
        "셀러가 디지털 상품을 전달했습니다. 내용을 확인하시고 구매확정을 진행해주세요.",
        Some(&format!("/orders/{}", order_id)),
    )
    .await;

    Ok(Json(json!({
        "data": {
            "order_id": order_id,
            "status": "delivered",
        }
    })))
}
