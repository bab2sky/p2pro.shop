use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use serde_json::json;
use std::str::FromStr;
use uuid::Uuid;

use crate::domain::coupon::Coupon;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// User-facing coupon routes
pub fn user_router() -> Router<AppState> {
    Router::new()
        .route("/my", get(my_coupons))
        .route("/claim", post(claim_coupon))
}

/// Seller coupon routes (FR-D01)
pub fn seller_router() -> Router<AppState> {
    Router::new()
        .route("/coupons", post(seller_create_coupon))
        .route("/coupons", get(seller_list_coupons))
        .route(
            "/coupons/{id}",
            put(seller_update_coupon).delete(seller_delete_coupon),
        )
}

/// Checkout available coupons route (FR-D03)
pub fn checkout_router() -> Router<AppState> {
    Router::new().route("/checkout/available-coupons", get(available_coupons))
}

/// Admin coupon routes (read)
pub fn admin_read_router() -> Router<AppState> {
    Router::new().route("/coupons", get(admin_list_coupons))
}

/// Admin coupon routes (write)
pub fn admin_write_router() -> Router<AppState> {
    Router::new()
        .route("/coupons", post(admin_create_coupon))
        .route(
            "/coupons/{id}",
            put(admin_update_coupon).delete(admin_deactivate_coupon),
        )
        .route("/coupons/{id}/issue", post(admin_bulk_issue))
}

// --- User Endpoints ---

#[derive(serde::Deserialize)]
struct MyCouponsQuery {
    status: Option<String>,
}

async fn my_coupons(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<MyCouponsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let status = query.status.unwrap_or_else(|| "available".into());

    let coupons = match status.as_str() {
        "used" => {
            sqlx::query_as::<_, (Uuid, Uuid, String, String, String, bigdecimal::BigDecimal, Option<bigdecimal::BigDecimal>, Option<bigdecimal::BigDecimal>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)>(
                r#"SELECT uc.id, c.id, c.code, c.name, c.discount_type, c.discount_value, c.max_discount, c.min_order_amount, uc.issued_at, uc.expires_at, uc.used_at
                   FROM user_coupons uc JOIN coupons c ON c.id = uc.coupon_id
                   WHERE uc.user_id = $1 AND uc.used_at IS NOT NULL
                   ORDER BY uc.used_at DESC"#,
            )
            .bind(auth.id)
            .fetch_all(&state.db)
            .await?
        }
        "expired" => {
            sqlx::query_as::<_, (Uuid, Uuid, String, String, String, bigdecimal::BigDecimal, Option<bigdecimal::BigDecimal>, Option<bigdecimal::BigDecimal>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)>(
                r#"SELECT uc.id, c.id, c.code, c.name, c.discount_type, c.discount_value, c.max_discount, c.min_order_amount, uc.issued_at, uc.expires_at, uc.used_at
                   FROM user_coupons uc JOIN coupons c ON c.id = uc.coupon_id
                   WHERE uc.user_id = $1 AND uc.used_at IS NULL AND uc.expires_at < NOW()
                   ORDER BY uc.expires_at DESC"#,
            )
            .bind(auth.id)
            .fetch_all(&state.db)
            .await?
        }
        _ => {
            // available
            sqlx::query_as::<_, (Uuid, Uuid, String, String, String, bigdecimal::BigDecimal, Option<bigdecimal::BigDecimal>, Option<bigdecimal::BigDecimal>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)>(
                r#"SELECT uc.id, c.id, c.code, c.name, c.discount_type, c.discount_value, c.max_discount, c.min_order_amount, uc.issued_at, uc.expires_at, uc.used_at
                   FROM user_coupons uc JOIN coupons c ON c.id = uc.coupon_id
                   WHERE uc.user_id = $1 AND uc.used_at IS NULL AND uc.expires_at > NOW() AND c.is_active = true
                   ORDER BY uc.expires_at ASC"#,
            )
            .bind(auth.id)
            .fetch_all(&state.db)
            .await?
        }
    };

    let data: Vec<serde_json::Value> = coupons
        .iter()
        .map(|c| {
            json!({
                "id": c.0,
                "coupon": {
                    "id": c.1,
                    "code": c.2,
                    "name": c.3,
                    "discount_type": c.4,
                    "discount_value": c.5,
                    "max_discount": c.6,
                    "min_order_amount": c.7,
                },
                "issued_at": c.8,
                "expires_at": c.9,
                "used_at": c.10,
            })
        })
        .collect();

    Ok(Json(json!({ "data": data })))
}

#[derive(serde::Deserialize)]
struct ClaimRequest {
    code: String,
}

async fn claim_coupon(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<ClaimRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-10: 트랜잭션 내에서 FOR UPDATE로 쿠폰 잠금 (TOCTOU 방지)
    let mut tx = state.db.begin().await?;

    let coupon = sqlx::query_as::<_, Coupon>(
        "SELECT id, code, name, description, discount_type, discount_value, max_discount, min_order_amount, max_uses, used_count, max_uses_per_user, is_active, starts_at, expires_at, target_type, target_value, created_at FROM coupons WHERE code = $1 AND is_active = true FOR UPDATE",
    )
    .bind(&req.code)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Coupon not found or inactive".into()))?;

    // FR-21: starts_at 검증 (아직 시작되지 않은 쿠폰)
    if coupon.starts_at > chrono::Utc::now() {
        return Err(AppError::Validation {
            message: "Coupon is not yet available".into(),
            field: Some("code".into()),
        });
    }

    if coupon.expires_at < chrono::Utc::now() {
        return Err(AppError::Validation {
            message: "Coupon has expired".into(),
            field: Some("code".into()),
        });
    }

    // FR-10: 원자적 used_count 증가 (max_uses 체크 포함)
    if coupon.max_uses.is_some() {
        let updated = sqlx::query(
            "UPDATE coupons SET used_count = used_count + 1 WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses)",
        )
        .bind(coupon.id)
        .execute(&mut *tx)
        .await?;
        if updated.rows_affected() == 0 {
            return Err(AppError::Validation {
                message: "Coupon usage limit reached".into(),
                field: Some("code".into()),
            });
        }
    }

    // FR-21: max_uses_per_user 검증 (트랜잭션 내)
    let user_claim_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM user_coupons WHERE user_id = $1 AND coupon_id = $2",
    )
    .bind(auth.id)
    .bind(coupon.id)
    .fetch_one(&mut *tx)
    .await?;

    let max_per_user = coupon.max_uses_per_user.unwrap_or(1);
    if user_claim_count >= max_per_user as i64 {
        return Err(AppError::Conflict(
            "Coupon claim limit per user reached".into(),
        ));
    }

    let uc_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO user_coupons (id, user_id, coupon_id, expires_at)
           VALUES ($1, $2, $3, $4)"#,
    )
    .bind(uc_id)
    .bind(auth.id)
    .bind(coupon.id)
    .bind(coupon.expires_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "data": {
            "id": uc_id,
            "coupon_name": coupon.name,
            "expires_at": coupon.expires_at,
        }
    })))
}

// --- Admin Endpoints ---

#[derive(serde::Deserialize)]
struct AdminCouponListQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    is_active: Option<bool>,
}

async fn admin_list_coupons(
    State(state): State<AppState>,
    Query(query): Query<AdminCouponListQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let (coupons, total) = if let Some(active) = query.is_active {
        let rows = sqlx::query_as::<_, Coupon>(
            "SELECT id, code, name, description, discount_type, discount_value, max_discount, min_order_amount, max_uses, used_count, max_uses_per_user, is_active, starts_at, expires_at, target_type, target_value, created_at FROM coupons WHERE is_active = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(active)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;
        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM coupons WHERE is_active = $1")
                .bind(active)
                .fetch_one(&state.db)
                .await?;
        (rows, count)
    } else {
        let rows = sqlx::query_as::<_, Coupon>(
            "SELECT id, code, name, description, discount_type, discount_value, max_discount, min_order_amount, max_uses, used_count, max_uses_per_user, is_active, starts_at, expires_at, target_type, target_value, created_at FROM coupons ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM coupons")
            .fetch_one(&state.db)
            .await?;
        (rows, count)
    };

    Ok(Json(json!({
        "data": coupons,
        "pagination": { "page": page, "per_page": per_page, "total": total }
    })))
}

#[derive(serde::Deserialize)]
struct CreateCouponRequest {
    code: String,
    name: String,
    description: Option<String>,
    discount_type: String,
    discount_value: String,
    max_discount: Option<String>,
    min_order_amount: Option<String>,
    max_uses: Option<i32>,
    max_uses_per_user: Option<i32>,
    starts_at: Option<chrono::DateTime<chrono::Utc>>,
    expires_at: chrono::DateTime<chrono::Utc>,
    target_type: Option<String>,
    target_value: Option<String>,
}

async fn admin_create_coupon(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateCouponRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // FR-11: 쿠폰 생성 입력 검증
    if req.discount_type != "fixed" && req.discount_type != "percent" {
        return Err(AppError::Validation {
            message: "discount_type must be 'fixed' or 'percent'".into(),
            field: Some("discount_type".into()),
        });
    }
    let discount_value = bigdecimal::BigDecimal::from_str(&req.discount_value).map_err(|_| {
        AppError::Validation {
            message: "discount_value must be a valid number".into(),
            field: Some("discount_value".into()),
        }
    })?;
    let max_discount = req
        .max_discount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "max_discount must be a valid number".into(),
            field: Some("max_discount".into()),
        })?;
    let min_order_amount = req
        .min_order_amount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "min_order_amount must be a valid number".into(),
            field: Some("min_order_amount".into()),
        })?;

    if discount_value <= 0 {
        return Err(AppError::Validation {
            message: "discount_value must be positive".into(),
            field: Some("discount_value".into()),
        });
    }
    if req.discount_type == "percent" && discount_value > 100 {
        return Err(AppError::Validation {
            message: "Percent discount cannot exceed 100".into(),
            field: Some("discount_value".into()),
        });
    }

    let id = Uuid::new_v4();
    let starts = req.starts_at.unwrap_or_else(chrono::Utc::now);

    // FR-11: starts_at < expires_at 검증
    if starts >= req.expires_at {
        return Err(AppError::Validation {
            message: "starts_at must be before expires_at".into(),
            field: Some("starts_at".into()),
        });
    }

    sqlx::query(
        r#"INSERT INTO coupons (id, code, name, description, discount_type, discount_value, max_discount, min_order_amount, max_uses, max_uses_per_user, starts_at, expires_at, target_type, target_value, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)"#,
    )
    .bind(id)
    .bind(&req.code)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.discount_type)
    .bind(&discount_value)
    .bind(&max_discount)
    .bind(&min_order_amount)
    .bind(req.max_uses)
    .bind(req.max_uses_per_user.unwrap_or(1))
    .bind(starts)
    .bind(req.expires_at)
    .bind(req.target_type.as_deref().unwrap_or("all"))
    .bind(&req.target_value)
    .bind(auth.id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("coupons_code_key") {
                return AppError::Conflict("Coupon code already exists".into());
            }
        }
        AppError::Database(e)
    })?;

    Ok(Json(json!({
        "data": {
            "id": id,
            "code": req.code,
            "name": req.name,
            "created_at": chrono::Utc::now(),
        }
    })))
}

async fn admin_update_coupon(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CreateCouponRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let discount_value = bigdecimal::BigDecimal::from_str(&req.discount_value).map_err(|_| {
        AppError::Validation {
            message: "discount_value must be a valid number".into(),
            field: Some("discount_value".into()),
        }
    })?;
    let max_discount = req
        .max_discount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "max_discount must be a valid number".into(),
            field: Some("max_discount".into()),
        })?;
    let min_order_amount = req
        .min_order_amount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "min_order_amount must be a valid number".into(),
            field: Some("min_order_amount".into()),
        })?;

    let result = sqlx::query(
        r#"UPDATE coupons SET
           name = $2, description = $3, discount_type = $4, discount_value = $5,
           max_discount = $6, min_order_amount = $7, max_uses = $8,
           max_uses_per_user = $9, expires_at = $10, target_type = $11,
           target_value = $12, updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.discount_type)
    .bind(&discount_value)
    .bind(&max_discount)
    .bind(&min_order_amount)
    .bind(req.max_uses)
    .bind(req.max_uses_per_user.unwrap_or(1))
    .bind(req.expires_at)
    .bind(req.target_type.as_deref().unwrap_or("all"))
    .bind(&req.target_value)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Coupon not found".into()));
    }

    Ok(Json(json!({ "data": { "updated": true } })))
}

async fn admin_deactivate_coupon(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result =
        sqlx::query("UPDATE coupons SET is_active = false, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&state.db)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Coupon not found".into()));
    }

    Ok(Json(json!({ "data": { "message": "Coupon deactivated" } })))
}

#[derive(serde::Deserialize)]
struct BulkIssueRequest {
    user_ids: Option<Vec<Uuid>>,
    issue_to: Option<String>,
}

async fn admin_bulk_issue(
    State(state): State<AppState>,
    Path(coupon_id): Path<Uuid>,
    Json(req): Json<BulkIssueRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let coupon = sqlx::query_as::<_, (Uuid, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, expires_at FROM coupons WHERE id = $1 AND is_active = true",
    )
    .bind(coupon_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Coupon not found or inactive".into()))?;

    let target_users: Vec<Uuid> = if let Some(ids) = req.user_ids {
        ids
    } else if req.issue_to.as_deref() == Some("all") {
        sqlx::query_scalar("SELECT id FROM users WHERE status = 'active'")
            .fetch_all(&state.db)
            .await?
    } else {
        return Err(AppError::Validation {
            message: "Provide user_ids or issue_to='all'".into(),
            field: None,
        });
    };

    // FR-33: 배치 INSERT로 대량 발급 최적화
    let total_users_count = target_users.len() as i64;
    let mut issued = 0i64;

    // Process in batches of 500
    for chunk in target_users.chunks(500) {
        if chunk.is_empty() {
            continue;
        }

        let mut query =
            String::from("INSERT INTO user_coupons (id, user_id, coupon_id, expires_at) VALUES ");
        let mut params: Vec<String> = Vec::with_capacity(chunk.len());
        for (i, _) in chunk.iter().enumerate() {
            let base = i * 4;
            params.push(format!(
                "(${}, ${}, ${}, ${})",
                base + 1,
                base + 2,
                base + 3,
                base + 4
            ));
        }
        query.push_str(&params.join(", "));
        query.push_str(" ON CONFLICT DO NOTHING");

        let mut q = sqlx::query(&query);
        for user_id in chunk {
            q = q
                .bind(Uuid::new_v4())
                .bind(user_id)
                .bind(coupon.0)
                .bind(coupon.1);
        }

        let result = q.execute(&state.db).await?;
        issued += result.rows_affected() as i64;
    }

    let already_issued = total_users_count - issued;

    Ok(Json(json!({
        "data": {
            "issued_count": issued,
            "already_issued_count": already_issued,
        }
    })))
}

// --- Seller Coupon Endpoints (FR-D01) ---

/// POST /api/seller/coupons — Create seller coupon
async fn seller_create_coupon(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateCouponRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.discount_type != "fixed" && req.discount_type != "percent" {
        return Err(AppError::Validation {
            message: "discount_type must be 'fixed' or 'percent'".into(),
            field: Some("discount_type".into()),
        });
    }
    let discount_value = bigdecimal::BigDecimal::from_str(&req.discount_value).map_err(|_| {
        AppError::Validation {
            message: "discount_value must be a valid number".into(),
            field: Some("discount_value".into()),
        }
    })?;
    let max_discount = req
        .max_discount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "max_discount must be a valid number".into(),
            field: Some("max_discount".into()),
        })?;
    let min_order_amount = req
        .min_order_amount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "min_order_amount must be a valid number".into(),
            field: Some("min_order_amount".into()),
        })?;

    let starts = req.starts_at.unwrap_or_else(chrono::Utc::now);
    if starts >= req.expires_at {
        return Err(AppError::Validation {
            message: "starts_at must be before expires_at".into(),
            field: Some("starts_at".into()),
        });
    }

    // Round 6c (migration 046): coupons.seller_id == seller_profiles(id).
    let seller_profile_id =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO coupons (id, code, name, description, discount_type, discount_value,
           max_discount, min_order_amount, max_uses, max_uses_per_user,
           starts_at, expires_at, target_type, target_value, seller_id, coupon_type, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'seller_specific', $13::text, $14, 'seller', $15)"#,
    )
    .bind(id)
    .bind(&req.code)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.discount_type)
    .bind(&discount_value)
    .bind(&max_discount)
    .bind(&min_order_amount)
    .bind(req.max_uses)
    .bind(req.max_uses_per_user.unwrap_or(1))
    .bind(starts)
    .bind(req.expires_at)
    .bind(auth.id.to_string())
    .bind(seller_profile_id)
    .bind(auth.id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("coupons_code_key") {
                return AppError::Conflict("Coupon code already exists".into());
            }
        }
        AppError::Database(e)
    })?;

    Ok(Json(json!({ "data": { "id": id, "code": req.code } })))
}

/// GET /api/seller/coupons — List seller's coupons
async fn seller_list_coupons(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c: coupons.seller_id == seller_profiles(id). join 으로 user_id 변환.
    let coupons = sqlx::query_as::<_, Coupon>(
        r#"SELECT c.id, c.code, c.name, c.description, c.discount_type, c.discount_value, c.max_discount,
           c.min_order_amount, c.max_uses, c.used_count, c.max_uses_per_user, c.is_active,
           c.starts_at, c.expires_at, c.target_type, c.target_value, c.created_at
           FROM coupons c
           JOIN seller_profiles sp ON sp.id = c.seller_id
           WHERE sp.user_id = $1
           ORDER BY c.created_at DESC"#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "data": coupons })))
}

/// PUT /api/seller/coupons/{id} — Update seller coupon
async fn seller_update_coupon(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(req): Json<CreateCouponRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let discount_value = bigdecimal::BigDecimal::from_str(&req.discount_value).map_err(|_| {
        AppError::Validation {
            message: "Invalid discount_value".into(),
            field: Some("discount_value".into()),
        }
    })?;
    let max_discount = req
        .max_discount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "Invalid max_discount".into(),
            field: Some("max_discount".into()),
        })?;
    let min_order_amount = req
        .min_order_amount
        .as_deref()
        .map(bigdecimal::BigDecimal::from_str)
        .transpose()
        .map_err(|_| AppError::Validation {
            message: "Invalid min_order_amount".into(),
            field: Some("min_order_amount".into()),
        })?;

    // Round 6c: coupons.seller_id == seller_profiles(id). subquery 로 user_id 변환.
    let result = sqlx::query(
        r#"UPDATE coupons SET name = $2, description = $3, discount_type = $4,
           discount_value = $5, max_discount = $6, min_order_amount = $7,
           max_uses = $8, max_uses_per_user = $9, expires_at = $10, updated_at = NOW()
           WHERE id = $1 AND seller_id = (SELECT id FROM seller_profiles WHERE user_id = $11)"#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.discount_type)
    .bind(&discount_value)
    .bind(&max_discount)
    .bind(&min_order_amount)
    .bind(req.max_uses)
    .bind(req.max_uses_per_user.unwrap_or(1))
    .bind(req.expires_at)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Coupon not found or not owned".into()));
    }
    Ok(Json(json!({ "data": { "updated": true } })))
}

/// DELETE /api/seller/coupons/{id} — Delete (deactivate) seller coupon
async fn seller_delete_coupon(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c: coupons.seller_id == seller_profiles(id).
    let result = sqlx::query(
        "UPDATE coupons SET is_active = false, updated_at = NOW() WHERE id = $1 AND seller_id = (SELECT id FROM seller_profiles WHERE user_id = $2)",
    )
    .bind(id)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Coupon not found or not owned".into()));
    }
    Ok(Json(json!({ "data": { "deleted": true } })))
}

// --- Checkout Available Coupons (FR-D03) ---

#[derive(serde::Deserialize)]
struct AvailableCouponsQuery {
    // API 계약 보존: 프론트가 seller_id 를 보내도 OK 이지만 현 SQL 은
    // 사용자 단위 필터만 적용. 향후 seller-스코프 쿠폰 제한 도입 시 사용.
    #[allow(dead_code)]
    seller_id: Option<Uuid>,
    order_amount: Option<f64>,
}

/// GET /api/checkout/available-coupons
async fn available_coupons(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<AvailableCouponsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let order_amount =
        bigdecimal::BigDecimal::try_from(query.order_amount.unwrap_or(0.0)).unwrap_or_default();

    let coupons = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            String,
            bigdecimal::BigDecimal,
            Option<bigdecimal::BigDecimal>,
            Option<bigdecimal::BigDecimal>,
            Option<String>,
        ),
    >(
        r#"SELECT c.id, c.code, c.name, c.discount_type, c.discount_value,
                  c.max_discount, c.min_order_amount, c.coupon_type
           FROM user_coupons uc
           JOIN coupons c ON c.id = uc.coupon_id
           WHERE uc.user_id = $1
             AND uc.used_at IS NULL
             AND uc.expires_at > NOW()
             AND c.is_active = true
             AND (c.min_order_amount IS NULL OR c.min_order_amount <= $2)
           ORDER BY c.discount_value DESC"#,
    )
    .bind(auth.id)
    .bind(&order_amount)
    .fetch_all(&state.db)
    .await?;

    let mut best_discount = bigdecimal::BigDecimal::from(0);
    let mut best_coupon_id: Option<Uuid> = None;

    let data: Vec<serde_json::Value> = coupons
        .iter()
        .map(|c| {
            let calc_discount = if c.3 == "percent" {
                let pct = &c.4 / bigdecimal::BigDecimal::from(100);
                let raw = &order_amount * &pct;
                match &c.5 {
                    Some(max) if &raw > max => max.clone(),
                    _ => raw,
                }
            } else {
                c.4.clone()
            };

            if calc_discount > best_discount {
                best_discount = calc_discount.clone();
                best_coupon_id = Some(c.0);
            }

            json!({
                "id": c.0, "code": c.1, "name": c.2,
                "discount_type": c.3, "discount_value": c.4,
                "max_discount": c.5, "min_order_amount": c.6,
                "coupon_type": c.7,
                "calculated_discount": calc_discount,
                "is_best": false,
            })
        })
        .collect();

    Ok(Json(json!({
        "data": {
            "coupons": data,
            "best_coupon_id": best_coupon_id,
            "best_discount": best_discount,
        }
    })))
}
