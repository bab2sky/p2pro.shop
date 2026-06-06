use axum::{
    extract::{Path, State},
    routing::{get, post},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::domain::legal::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Public legal routes
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/business-info", get(get_business_info))
        .route("/terms", get(get_terms_of_service))
        .route("/privacy", get(get_privacy_policy))
        .route("/about", get(get_about_page))
}

/// Public routes nested under other paths
pub fn seller_business_router() -> Router<AppState> {
    Router::new().route("/sellers/{id}/business-info", get(get_seller_business_info))
}

/// Public routes for category attributes
pub fn category_attributes_router() -> Router<AppState> {
    Router::new().route("/categories/{id}/attributes", get(get_category_attributes))
}

/// Public routes for product legal info
pub fn product_legal_public_router() -> Router<AppState> {
    Router::new().route("/products/{id}/legal-info", get(get_product_legal_info))
}

/// Protected routes for product attributes (seller writes)
pub fn product_attributes_router() -> Router<AppState> {
    Router::new().route("/products/{id}/attributes", post(save_product_attributes))
}

// --- Handlers ---

/// GET /api/legal/terms — 이용약관 조회 (system_settings에서 동적 로딩)
async fn get_terms_of_service(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let content = sqlx::query_scalar::<_, String>(
        "SELECT value FROM system_settings WHERE key = 'terms_of_service'",
    )
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_default();

    Ok(Json(serde_json::json!({ "data": { "content": content } })))
}

/// GET /api/legal/privacy — 개인정보처리방침 조회 (system_settings에서 동적 로딩)
async fn get_privacy_policy(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let content = sqlx::query_scalar::<_, String>(
        "SELECT value FROM system_settings WHERE key = 'privacy_policy'",
    )
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_default();

    Ok(Json(serde_json::json!({ "data": { "content": content } })))
}

/// GET /api/legal/about — 회사소개 페이지 조회 (system_settings에서 동적 로딩)
async fn get_about_page(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let content = sqlx::query_scalar::<_, String>(
        "SELECT value FROM system_settings WHERE key = 'about_page'",
    )
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_default();

    Ok(Json(serde_json::json!({ "data": { "content": content } })))
}

/// GET /api/legal/business-info
/// 플랫폼 사업자 정보 조회 (FR-A01, FR-A03)
async fn get_business_info(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let settings = sqlx::query_as::<_, (String, String)>(
        "SELECT key, value FROM system_settings WHERE key LIKE 'business_%' OR key = 'escrow_service_description'"
    )
    .fetch_all(&state.db)
    .await?;

    let get_val = |k: &str| -> String {
        settings
            .iter()
            .find(|(key, _)| key == k)
            .map(|(_, v)| v.clone())
            .unwrap_or_default()
    };

    let info = BusinessInfoResponse {
        company_name: get_val("business_company_name"),
        representative: get_val("business_representative"),
        business_number: get_val("business_number"),
        online_sales_number: get_val("business_online_sales_number"),
        address: get_val("business_address"),
        customer_center: get_val("business_customer_center"),
        email: get_val("business_email"),
        escrow_service: EscrowServiceInfo {
            provider: "USDT Escrow".to_string(),
            description: get_val("escrow_service_description"),
        },
    };

    Ok(Json(serde_json::json!({ "data": info })))
}

/// GET /api/sellers/{id}/business-info
/// 판매자 사업자 정보 조회 (FR-A02)
async fn get_seller_business_info(
    State(state): State<AppState>,
    Path(seller_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let seller = sqlx::query_as::<
        _,
        (
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"SELECT seller_type, business_name, business_number,
                  representative_name, business_address, business_type, business_category
           FROM seller_profiles WHERE user_id = $1 AND status = 'approved'"#,
    )
    .bind(seller_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Seller not found".to_string()))?;

    let info = SellerBusinessInfoResponse {
        seller_type: seller.0,
        business_name: seller.1,
        business_number: seller.2,
        representative_name: seller.3,
        business_address: seller.4,
        business_type: seller.5,
        business_category: seller.6,
    };

    Ok(Json(serde_json::json!({ "data": info })))
}

/// GET /api/categories/{id}/attributes
/// 카테고리별 필수 속성 조회 (FR-A06)
async fn get_category_attributes(
    State(state): State<AppState>,
    Path(category_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let attrs = sqlx::query_as::<_, CategoryAttribute>(
        r#"SELECT id, category_id, attribute_name, attribute_name_en,
                  attribute_type, is_required, options, placeholder,
                  sort_order, created_at, updated_at
           FROM category_attributes
           WHERE category_id = $1
           ORDER BY sort_order, attribute_name"#,
    )
    .bind(category_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": attrs })))
}

/// GET /api/products/{id}/legal-info
/// 상품 법적 정보 조회 (FR-A05, FR-A06, FR-A07)
async fn get_product_legal_info(
    State(state): State<AppState>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // 1. Product base legal fields
    let product = sqlx::query_as::<
        _,
        (
            Option<String>,
            Option<String>,
            Option<String>,
            Option<serde_json::Value>,
        ),
    >(
        r#"SELECT manufacturer, origin_country, condition, kc_certification
           FROM products WHERE id = $1"#,
    )
    .bind(product_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Product not found".to_string()))?;

    // 2. Category attributes values
    let attrs = sqlx::query_as::<_, ProductAttributeDisplay>(
        r#"SELECT ca.attribute_name as name, pa.value
           FROM product_attributes pa
           JOIN category_attributes ca ON ca.id = pa.attribute_id
           WHERE pa.product_id = $1
           ORDER BY ca.sort_order"#,
    )
    .bind(product_id)
    .fetch_all(&state.db)
    .await?;

    let info = ProductLegalInfoResponse {
        manufacturer: product.0,
        origin_country: product.1,
        condition: product.2,
        kc_certification: product.3,
        category_attributes: attrs,
        withdrawal_rights: WithdrawalRightsInfo::default(),
    };

    Ok(Json(serde_json::json!({ "data": info })))
}

/// POST /api/products/{id}/attributes
/// 상품 속성 저장 (FR-A06)
async fn save_product_attributes(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(product_id): Path<Uuid>,
    Json(req): Json<SaveProductAttributesRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // 1. Verify product ownership
    let product_seller = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT sp.user_id FROM products p
           JOIN seller_profiles sp ON sp.id = p.seller_id
           WHERE p.id = $1"#,
    )
    .bind(product_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Product not found".to_string()))?;

    if product_seller != user.id {
        return Err(AppError::Forbidden("Not the product owner".to_string()));
    }

    // 2. Validate required attributes
    let category_id =
        sqlx::query_scalar::<_, Uuid>("SELECT category_id FROM products WHERE id = $1")
            .bind(product_id)
            .fetch_one(&state.db)
            .await?;

    let required_attrs = sqlx::query_as::<_, (Uuid, String, String, Option<serde_json::Value>)>(
        r#"SELECT id, attribute_name, attribute_type, options
           FROM category_attributes
           WHERE category_id = $1 AND is_required = true"#,
    )
    .bind(category_id)
    .fetch_all(&state.db)
    .await?;

    // Check all required attributes are provided
    for (attr_id, attr_name, attr_type, options) in &required_attrs {
        let provided = req.attributes.iter().find(|a| a.attribute_id == *attr_id);
        match provided {
            None => {
                return Err(AppError::Validation {
                    message: format!("필수 속성 '{}'이(가) 누락되었습니다", attr_name),
                    field: Some(attr_name.clone()),
                });
            }
            Some(input) => {
                if input.value.trim().is_empty() {
                    return Err(AppError::Validation {
                        message: format!("필수 속성 '{}'의 값이 비어있습니다", attr_name),
                        field: Some(attr_name.clone()),
                    });
                }
                // Validate select type options
                if attr_type == "select" {
                    if let Some(opts) = options {
                        if let Some(arr) = opts.as_array() {
                            let valid_options: Vec<&str> =
                                arr.iter().filter_map(|v| v.as_str()).collect();
                            if !valid_options.contains(&input.value.as_str()) {
                                return Err(AppError::Validation {
                                    message: format!(
                                        "'{}'에 유효하지 않은 값입니다. 허용: {:?}",
                                        attr_name, valid_options
                                    ),
                                    field: Some(attr_name.clone()),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Upsert attributes
    let mut saved_count = 0i32;
    for attr in &req.attributes {
        sqlx::query(
            r#"INSERT INTO product_attributes (product_id, attribute_id, value)
               VALUES ($1, $2, $3)
               ON CONFLICT (product_id, attribute_id)
               DO UPDATE SET value = EXCLUDED.value"#,
        )
        .bind(product_id)
        .bind(attr.attribute_id)
        .bind(&attr.value)
        .execute(&state.db)
        .await?;
        saved_count += 1;
    }

    Ok(Json(serde_json::json!({
        "data": { "saved_count": saved_count }
    })))
}
