use axum::{
    extract::{Path, State},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use bigdecimal::BigDecimal;
use std::collections::HashMap;
use uuid::Uuid;

use crate::domain::cart::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_cart))
        .route("/", post(add_to_cart))
        .route("/{id}", put(update_cart_item))
        .route("/{id}", delete(remove_cart_item))
}

async fn list_cart(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<CartResponse>, AppError> {
    let items = sqlx::query_as::<_, CartItemDetail>(
        r#"SELECT ci.id, ci.product_id, ci.option_id, ci.quantity,
                  p.title as product_title,
                  p.final_price as unit_price,
                  p.stock,
                  p.shipping_fee,
                  pi.image_url as product_image,
                  CASE WHEN po.id IS NOT NULL THEN po.option_name || ': ' || po.option_value ELSE NULL END as option_label,
                  sp.id as seller_id,
                  u.nickname as seller_name,
                  (p.final_price + COALESCE(po.additional_price, 0)) * ci.quantity as subtotal,
                  c.name as category_name
           FROM cart_items ci
           JOIN products p ON p.id = ci.product_id
           LEFT JOIN categories c ON c.id = p.category_id
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_main = true
           LEFT JOIN product_options po ON po.id = ci.option_id
           JOIN seller_profiles sp ON sp.id = p.seller_id
           JOIN users u ON u.id = sp.user_id
           WHERE ci.user_id = $1
           ORDER BY sp.id, ci.created_at"#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    // Group by seller
    let mut groups: HashMap<Uuid, CartGroup> = HashMap::new();
    let mut order: Vec<Uuid> = Vec::new();

    for item in items {
        let sid = item.seller_id.unwrap_or_default();
        if let std::collections::hash_map::Entry::Vacant(e) = groups.entry(sid) {
            order.push(sid);
            e.insert(CartGroup {
                seller_id: sid,
                seller_name: item.seller_name.clone().unwrap_or_default(),
                items: vec![],
                subtotal: BigDecimal::from(0),
                shipping_fee: item
                    .shipping_fee
                    .clone()
                    .unwrap_or_else(|| BigDecimal::from(0)),
            });
        }
        if let Some(group) = groups.get_mut(&sid) {
            if let Some(ref sub) = item.subtotal {
                group.subtotal += sub;
            }
            group.items.push(item);
        }
    }

    let data: Vec<CartGroup> = order
        .into_iter()
        .filter_map(|id| groups.remove(&id))
        .collect();

    Ok(Json(CartResponse { data }))
}

async fn add_to_cart(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<AddToCartRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.quantity < 1 {
        return Err(AppError::Validation {
            message: "Quantity must be at least 1".into(),
            field: Some("quantity".into()),
        });
    }

    // FR-15: 최대 수량 99 제한
    if req.quantity > 99 {
        return Err(AppError::Validation {
            message: "Maximum quantity per item is 99".into(),
            field: Some("quantity".into()),
        });
    }

    // FR-15: 상품 존재 + 재고 확인
    let product = sqlx::query_as::<_, (i32,)>(
        "SELECT stock FROM products WHERE id = $1 AND status = 'active'",
    )
    .bind(req.product_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Product not found".into()))?;

    if product.0 < req.quantity {
        return Err(AppError::Validation {
            message: format!("Insufficient stock. Available: {}", product.0),
            field: Some("quantity".into()),
        });
    }

    // FR-15: 옵션 재고 확인
    if let Some(opt_id) = req.option_id {
        let opt_stock =
            sqlx::query_scalar::<_, i32>("SELECT stock FROM product_options WHERE id = $1")
                .bind(opt_id)
                .fetch_optional(&state.db)
                .await?
                .ok_or_else(|| AppError::NotFound("Product option not found".into()))?;
        if opt_stock < req.quantity {
            return Err(AppError::Validation {
                message: format!("Insufficient option stock. Available: {}", opt_stock),
                field: Some("quantity".into()),
            });
        }
    }

    // FR-15: 기존 장바구니 수량 확인 후 누적 수량 검증
    let existing_qty = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT quantity FROM cart_items WHERE user_id = $1 AND product_id = $2 AND option_id IS NOT DISTINCT FROM $3",
    )
    .bind(auth.id)
    .bind(req.product_id)
    .bind(req.option_id)
    .fetch_optional(&state.db)
    .await?
    .flatten()
    .unwrap_or(0);

    let total_qty = existing_qty + req.quantity;
    if total_qty > 99 {
        return Err(AppError::Validation {
            message: format!(
                "Total quantity cannot exceed 99. Current: {}, Adding: {}",
                existing_qty, req.quantity
            ),
            field: Some("quantity".into()),
        });
    }
    if total_qty > product.0 {
        return Err(AppError::Validation {
            message: format!(
                "Total quantity exceeds stock. Stock: {}, Total: {}",
                product.0, total_qty
            ),
            field: Some("quantity".into()),
        });
    }

    // UPSERT: add quantity if same product+option already in cart
    sqlx::query(
        r#"INSERT INTO cart_items (id, user_id, product_id, option_id, quantity)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, product_id, option_id)
           DO UPDATE SET quantity = cart_items.quantity + $5, updated_at = NOW()"#,
    )
    .bind(Uuid::new_v4())
    .bind(auth.id)
    .bind(req.product_id)
    .bind(req.option_id)
    .bind(req.quantity)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "added": true } })))
}

async fn update_cart_item(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCartRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.quantity < 1 {
        return Err(AppError::Validation {
            message: "Quantity must be at least 1".into(),
            field: Some("quantity".into()),
        });
    }

    // FR-15: 최대 수량 99 제한
    if req.quantity > 99 {
        return Err(AppError::Validation {
            message: "Maximum quantity per item is 99".into(),
            field: Some("quantity".into()),
        });
    }

    // FR-15: 재고 확인
    let stock = sqlx::query_scalar::<_, Option<i32>>(
        r#"SELECT p.stock FROM cart_items ci
           JOIN products p ON p.id = ci.product_id
           WHERE ci.id = $1 AND ci.user_id = $2"#,
    )
    .bind(id)
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?
    .flatten();

    if let Some(stock) = stock {
        if req.quantity > stock {
            return Err(AppError::Validation {
                message: format!("Quantity exceeds stock. Available: {}", stock),
                field: Some("quantity".into()),
            });
        }
    }

    let rows = sqlx::query(
        "UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
    )
    .bind(req.quantity)
    .bind(id)
    .bind(auth.id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Cart item not found".into()));
    }

    Ok(Json(serde_json::json!({ "data": { "updated": true } })))
}

async fn remove_cart_item(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = sqlx::query("DELETE FROM cart_items WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.id)
        .execute(&state.db)
        .await?
        .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Cart item not found".into()));
    }

    Ok(Json(serde_json::json!({ "data": { "deleted": true } })))
}
