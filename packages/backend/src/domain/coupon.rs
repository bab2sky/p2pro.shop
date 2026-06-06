use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Coupon {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub discount_type: String,
    pub discount_value: BigDecimal,
    pub max_discount: Option<BigDecimal>,
    pub min_order_amount: Option<BigDecimal>,
    pub max_uses: Option<i32>,
    pub used_count: i32,
    pub max_uses_per_user: Option<i32>,
    pub is_active: bool,
    pub starts_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub target_type: Option<String>,
    pub target_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct CouponDiscount {
    pub coupon_id: Uuid,
    pub discount_amount: BigDecimal,
    pub original_total: BigDecimal,
    pub discounted_total: BigDecimal,
}

/// Validate and calculate coupon discount for an order.
pub fn calculate_discount(coupon: &Coupon, order_total: &BigDecimal) -> Result<BigDecimal, String> {
    if !coupon.is_active {
        return Err("Coupon is not active".into());
    }

    let now = Utc::now();
    if now < coupon.starts_at || now > coupon.expires_at {
        return Err("Coupon is expired or not yet valid".into());
    }

    if let Some(max) = coupon.max_uses {
        if coupon.used_count >= max {
            return Err("Coupon usage limit reached".into());
        }
    }

    if let Some(min) = &coupon.min_order_amount {
        if order_total < min {
            return Err(format!(
                "Order total must be at least {} to use this coupon",
                min
            ));
        }
    }

    let discount = match coupon.discount_type.as_str() {
        "fixed" => coupon.discount_value.clone(),
        "percent" => {
            let raw = order_total * &coupon.discount_value / BigDecimal::from(100);
            if let Some(max_d) = &coupon.max_discount {
                if &raw > max_d {
                    max_d.clone()
                } else {
                    raw
                }
            } else {
                raw
            }
        }
        _ => return Err("Invalid discount type".into()),
    };

    let discount = if &discount > order_total {
        order_total.clone()
    } else {
        discount
    };

    Ok(discount)
}
