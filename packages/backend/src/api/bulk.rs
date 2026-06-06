use axum::{
    extract::{Multipart, Path, Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::domain::bulk::*;
use crate::domain::common::PaginationParams;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Seller bulk operation routes
pub fn seller_router() -> Router<AppState> {
    Router::new()
        .route("/seller/bulk/upload", post(bulk_upload))
        .route("/seller/bulk/logs", get(bulk_upload_logs))
        .route("/seller/bulk/template", get(download_template))
        .route("/seller/products/{id}/duplicate", post(duplicate_product))
        .route("/seller/products/bulk-status", put(bulk_status_change))
        .route("/seller/products/bulk-price", put(bulk_price_change))
        .route("/seller/orders/export", get(export_orders))
        .route("/seller/settlement/export", get(export_settlements))
        .route("/products/{id}/draft", post(save_draft))
        .route("/products/{id}/schedule", post(schedule_product))
}

/// Product view routes (public)
pub fn view_router() -> Router<AppState> {
    Router::new()
        .route("/products/{id}/view", post(record_view))
        .route("/products/{id}/views", get(get_view_stats))
}

/// POST /api/seller/bulk/upload — FR-C01 대량 등록
async fn bulk_upload(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<BulkUploadParams>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    let valid_types = ["create", "update", "status", "price"];
    if !valid_types.contains(&params.upload_type.as_str()) {
        return Err(AppError::Validation {
            message: "Invalid upload_type. Must be: create, update, status, price".into(),
            field: Some("upload_type".into()),
        });
    }

    // Read uploaded file
    let mut file_data: Option<(String, Vec<u8>)> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation {
            message: format!("Multipart error: {e}"),
            field: None,
        })?
    {
        if field.name() == Some("file") {
            let file_name = field.file_name().unwrap_or("upload.xlsx").to_string();
            let data = field.bytes().await.map_err(|e| AppError::Validation {
                message: format!("File read error: {e}"),
                field: None,
            })?;
            file_data = Some((file_name, data.to_vec()));
            break;
        }
    }

    let (file_name, data) = file_data.ok_or_else(|| AppError::Validation {
        message: "No file uploaded".into(),
        field: Some("file".into()),
    })?;

    // Parse Excel with calamine
    use calamine::{Data, Reader};
    let cursor = std::io::Cursor::new(&data);
    let mut workbook: calamine::Xlsx<_> =
        calamine::Xlsx::new(cursor).map_err(|e| AppError::Validation {
            message: format!("Invalid Excel file: {e}"),
            field: Some("file".into()),
        })?;

    let sheet_names: Vec<String> = workbook.sheet_names().to_owned();
    let sheet_name = sheet_names
        .first()
        .ok_or_else(|| AppError::Validation {
            message: "Excel file has no sheets".into(),
            field: Some("file".into()),
        })?
        .clone();

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| AppError::Validation {
            message: format!("Cannot read sheet: {e}"),
            field: Some("file".into()),
        })?;

    let rows: Vec<Vec<String>> = range
        .rows()
        .skip(1) // skip header row
        .map(|row: &[Data]| {
            row.iter()
                .map(|cell: &Data| cell.to_string())
                .collect::<Vec<String>>()
        })
        .collect();

    let total_rows = rows.len() as i32;
    let log_id = Uuid::new_v4();

    // Round 6c (migration 046): bulk_upload_logs.seller_id == seller_profiles(id).
    let seller_profile_id =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM seller_profiles WHERE user_id = $1")
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Seller profile not found".into()))?;

    // Create log entry
    sqlx::query(
        r#"INSERT INTO bulk_upload_logs (id, seller_id, upload_type, file_name, total_rows, status)
           VALUES ($1, $2, $3, $4, $5, 'processing')"#,
    )
    .bind(log_id)
    .bind(seller_profile_id)
    .bind(&params.upload_type)
    .bind(&file_name)
    .bind(total_rows)
    .execute(&state.db)
    .await?;

    let mut success_count = 0i32;
    let mut error_count = 0i32;
    let mut errors: Vec<BulkRowError> = Vec::new();

    match params.upload_type.as_str() {
        "price" => {
            // Expected columns: product_id, price
            for (idx, row) in rows.iter().enumerate() {
                let row_num = (idx + 2) as i32; // 1-based, skip header
                if row.len() < 2 {
                    errors.push(BulkRowError {
                        row: row_num,
                        field: "columns".into(),
                        message: "Requires at least 2 columns (product_id, price)".into(),
                    });
                    error_count += 1;
                    continue;
                }
                let product_id = match Uuid::parse_str(row[0].trim()) {
                    Ok(id) => id,
                    Err(_) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "product_id".into(),
                            message: "Invalid UUID".into(),
                        });
                        error_count += 1;
                        continue;
                    }
                };
                let price: f64 = match row[1].trim().parse() {
                    Ok(p) => p,
                    Err(_) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "price".into(),
                            message: "Invalid price number".into(),
                        });
                        error_count += 1;
                        continue;
                    }
                };

                let result = sqlx::query(
                    "UPDATE products SET price = $2, updated_at = NOW() WHERE id = $1 AND seller_id = $3",
                )
                .bind(product_id)
                .bind(bigdecimal::BigDecimal::try_from(price).unwrap_or_default())
                .bind(auth.id)
                .execute(&state.db)
                .await;

                match result {
                    Ok(r) if r.rows_affected() > 0 => success_count += 1,
                    Ok(_) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "product_id".into(),
                            message: "Product not found or not owned".into(),
                        });
                        error_count += 1;
                    }
                    Err(e) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "db".into(),
                            message: e.to_string(),
                        });
                        error_count += 1;
                    }
                }
            }
        }
        "status" => {
            // Expected columns: product_id, status (active/inactive)
            for row in rows.iter() {
                if row.len() < 2 {
                    error_count += 1;
                    continue;
                }
                let product_id = match Uuid::parse_str(row[0].trim()) {
                    Ok(id) => id,
                    Err(_) => {
                        error_count += 1;
                        continue;
                    }
                };
                let is_active = row[1].trim().to_lowercase() == "active";

                let result = sqlx::query(
                    "UPDATE products SET is_active = $2, updated_at = NOW() WHERE id = $1 AND seller_id = $3",
                )
                .bind(product_id)
                .bind(is_active)
                .bind(auth.id)
                .execute(&state.db)
                .await;

                match result {
                    Ok(r) if r.rows_affected() > 0 => success_count += 1,
                    _ => error_count += 1,
                }
            }
        }
        "create" => {
            // Expected columns: title, description, price, category_slug, stock_quantity
            // Resolve seller_id from seller_profiles
            let seller = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM seller_profiles WHERE user_id = $1 AND status = 'approved'",
            )
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::Forbidden("Seller not approved".into()))?;

            for (idx, row) in rows.iter().enumerate() {
                let row_num = (idx + 2) as i32;
                if row.len() < 5 {
                    errors.push(BulkRowError {
                        row: row_num,
                        field: "columns".into(),
                        message: "Requires at least 5 columns (title, description, price, category_slug, stock_quantity)".into(),
                    });
                    error_count += 1;
                    continue;
                }

                let title = row[0].trim().to_string();
                if title.is_empty() || title.chars().count() > 200 {
                    errors.push(BulkRowError {
                        row: row_num,
                        field: "title".into(),
                        message: "Title must be 1-200 characters".into(),
                    });
                    error_count += 1;
                    continue;
                }

                let description = row[1].trim().to_string();
                let description_opt = if description.is_empty() {
                    None
                } else {
                    Some(description)
                };

                let price: f64 = match row[2].trim().parse() {
                    Ok(p) if p > 0.0 => p,
                    _ => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "price".into(),
                            message: "Price must be a positive number".into(),
                        });
                        error_count += 1;
                        continue;
                    }
                };

                let category_slug = row[3].trim().to_string();
                let category_id = match sqlx::query_scalar::<_, Uuid>(
                    "SELECT id FROM categories WHERE slug = $1 AND is_active = true",
                )
                .bind(&category_slug)
                .fetch_optional(&state.db)
                .await
                {
                    Ok(Some(id)) => id,
                    Ok(None) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "category_slug".into(),
                            message: format!("Category '{}' not found", category_slug),
                        });
                        error_count += 1;
                        continue;
                    }
                    Err(e) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "db".into(),
                            message: e.to_string(),
                        });
                        error_count += 1;
                        continue;
                    }
                };

                let stock: i32 = match row[4].trim().parse() {
                    Ok(s) if s >= 0 => s,
                    _ => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "stock_quantity".into(),
                            message: "Stock must be a non-negative integer".into(),
                        });
                        error_count += 1;
                        continue;
                    }
                };

                // Fetch commission_rate from category
                let commission_rate = sqlx::query_scalar::<_, bigdecimal::BigDecimal>(
                    "SELECT commission_rate FROM categories WHERE id = $1",
                )
                .bind(category_id)
                .fetch_optional(&state.db)
                .await?
                .unwrap_or_else(|| bigdecimal::BigDecimal::try_from(5.0).unwrap());

                let product_id = Uuid::new_v4();
                let price_bd = bigdecimal::BigDecimal::try_from(price).unwrap_or_default();
                let default_margin = bigdecimal::BigDecimal::try_from(10.0).unwrap();

                let result = sqlx::query(
                    r#"INSERT INTO products (id, seller_id, category_id, title, description,
                       base_price, margin_rate, commission_rate, stock, status)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')"#,
                )
                .bind(product_id)
                .bind(seller)
                .bind(category_id)
                .bind(&title)
                .bind(&description_opt)
                .bind(&price_bd)
                .bind(&default_margin)
                .bind(&commission_rate)
                .bind(stock)
                .execute(&state.db)
                .await;

                match result {
                    Ok(_) => success_count += 1,
                    Err(e) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "db".into(),
                            message: e.to_string(),
                        });
                        error_count += 1;
                    }
                }
            }
        }
        "update" => {
            // Expected columns: product_id, title, description, price, stock_quantity
            for (idx, row) in rows.iter().enumerate() {
                let row_num = (idx + 2) as i32;
                if row.len() < 2 {
                    errors.push(BulkRowError {
                        row: row_num,
                        field: "columns".into(),
                        message: "Requires at least 2 columns (product_id, + fields to update)"
                            .into(),
                    });
                    error_count += 1;
                    continue;
                }

                let product_id = match Uuid::parse_str(row[0].trim()) {
                    Ok(id) => id,
                    Err(_) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "product_id".into(),
                            message: "Invalid UUID".into(),
                        });
                        error_count += 1;
                        continue;
                    }
                };

                // Verify product ownership
                let exists = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM products p JOIN seller_profiles sp ON sp.id = p.seller_id WHERE p.id = $1 AND sp.user_id = $2)",
                )
                .bind(product_id)
                .bind(auth.id)
                .fetch_one(&state.db)
                .await
                .unwrap_or(false);

                if !exists {
                    errors.push(BulkRowError {
                        row: row_num,
                        field: "product_id".into(),
                        message: "Product not found or not owned".into(),
                    });
                    error_count += 1;
                    continue;
                }

                // Parse optional fields: title (col 1), description (col 2), price (col 3), stock (col 4)
                let title = row.get(1).map(|s| s.trim()).filter(|s| !s.is_empty());
                let description = row.get(2).map(|s| s.trim()).filter(|s| !s.is_empty());
                let price: Option<bigdecimal::BigDecimal> = row
                    .get(3)
                    .and_then(|s| s.trim().parse::<f64>().ok())
                    .filter(|&p| p > 0.0)
                    .and_then(|p| bigdecimal::BigDecimal::try_from(p).ok());
                let stock: Option<i32> = row
                    .get(4)
                    .and_then(|s| s.trim().parse::<i32>().ok())
                    .filter(|&s| s >= 0);

                // Validate title length if provided
                if let Some(t) = title {
                    if t.chars().count() > 200 {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "title".into(),
                            message: "Title must be 1-200 characters".into(),
                        });
                        error_count += 1;
                        continue;
                    }
                }

                let result = sqlx::query(
                    r#"UPDATE products SET
                       title = COALESCE($2, title),
                       description = COALESCE($3, description),
                       base_price = COALESCE($4, base_price),
                       stock = COALESCE($5, stock),
                       updated_at = NOW()
                       WHERE id = $1"#,
                )
                .bind(product_id)
                .bind(title)
                .bind(description)
                .bind(&price)
                .bind(stock)
                .execute(&state.db)
                .await;

                match result {
                    Ok(r) if r.rows_affected() > 0 => success_count += 1,
                    Ok(_) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "product_id".into(),
                            message: "Product not found".into(),
                        });
                        error_count += 1;
                    }
                    Err(e) => {
                        errors.push(BulkRowError {
                            row: row_num,
                            field: "db".into(),
                            message: e.to_string(),
                        });
                        error_count += 1;
                    }
                }
            }
        }
        _ => {
            // Unknown type — should not reach here due to validation above
            return Err(AppError::Validation {
                message: "Unsupported upload_type".into(),
                field: Some("upload_type".into()),
            });
        }
    }

    // Update log
    let error_json = serde_json::to_value(&errors).unwrap_or_default();
    sqlx::query(
        r#"UPDATE bulk_upload_logs SET
           success_count = $2, error_count = $3, error_details = $4,
           status = 'completed', completed_at = NOW()
           WHERE id = $1"#,
    )
    .bind(log_id)
    .bind(success_count)
    .bind(error_count)
    .bind(&error_json)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": BulkUploadResult {
            log_id,
            total_rows,
            success_count,
            error_count,
            errors,
        }
    })))
}

/// GET /api/seller/bulk/logs — Bulk upload history
async fn bulk_upload_logs(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Round 6c: bulk_upload_logs.seller_id == seller_profiles(id). 단일 join 으로 조회.
    let logs = sqlx::query_as::<_, BulkUploadLog>(
        r#"SELECT bul.* FROM bulk_upload_logs bul
           JOIN seller_profiles sp ON sp.id = bul.seller_id
           WHERE sp.user_id = $1
           ORDER BY bul.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(auth.id)
    .bind(params.per_page())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": logs })))
}

/// GET /api/seller/bulk/template — Download Excel template
async fn download_template(
    Query(params): Query<BulkUploadParams>,
) -> Result<(axum::http::StatusCode, axum::http::HeaderMap, Vec<u8>), AppError> {
    use rust_xlsxwriter::*;

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    let headers = match params.upload_type.as_str() {
        "price" => vec!["product_id", "price"],
        "status" => vec!["product_id", "status (active/inactive)"],
        "create" => vec![
            "title",
            "description",
            "price",
            "category_slug",
            "stock_quantity",
        ],
        "update" => vec![
            "product_id",
            "title",
            "description",
            "price",
            "stock_quantity",
        ],
        _ => vec!["product_id", "title", "description", "price"],
    };

    for (col, header) in headers.iter().enumerate() {
        let _ = worksheet.write_string(0, col as u16, *header);
    }

    let buf = workbook
        .save_to_buffer()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?;

    let mut headers_map = axum::http::HeaderMap::new();
    headers_map.insert(
        axum::http::header::CONTENT_TYPE,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            .parse()
            .unwrap(),
    );
    headers_map.insert(
        axum::http::header::CONTENT_DISPOSITION,
        format!(
            "attachment; filename=\"template_{}.xlsx\"",
            params.upload_type
        )
        .parse()
        .unwrap(),
    );

    Ok((axum::http::StatusCode::OK, headers_map, buf))
}

/// POST /api/seller/products/{id}/duplicate — FR-C06 상품 복제
async fn duplicate_product(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let new_id = Uuid::new_v4();

    // Copy product with new ID, title prefixed with [복사]
    let result = sqlx::query_scalar::<_, Uuid>(
        r#"INSERT INTO products (id, seller_id, category_id, title, description, price, stock_quantity,
               images, is_active, margin_percent, manufacturer, origin_country, condition,
               kc_certification, search_tags, is_draft)
           SELECT $2, seller_id, category_id, '[복사] ' || title, description, price, stock_quantity,
               images, false, margin_percent, manufacturer, origin_country, condition,
               kc_certification, search_tags, true
           FROM products
           WHERE id = $1 AND seller_id = $3
           RETURNING id"#,
    )
    .bind(product_id)
    .bind(new_id)
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?;

    let created_id =
        result.ok_or_else(|| AppError::NotFound("Product not found or not owned".into()))?;

    // Copy options
    sqlx::query(
        r#"INSERT INTO product_options (id, product_id, option_name, option_value, additional_price, stock_quantity, image_url)
           SELECT gen_random_uuid(), $2, option_name, option_value, additional_price, stock_quantity, image_url
           FROM product_options WHERE product_id = $1"#,
    )
    .bind(product_id)
    .bind(created_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "id": created_id } })))
}

/// POST /api/products/{id}/view — FR-C10 조회수 트래킹
async fn record_view(
    State(state): State<AppState>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("INSERT INTO product_views (product_id) VALUES ($1)")
        .bind(product_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "data": { "recorded": true } })))
}

/// GET /api/products/{id}/views — View statistics
async fn get_view_stats(
    State(state): State<AppState>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let total =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM product_views WHERE product_id = $1")
            .bind(product_id)
            .fetch_one(&state.db)
            .await?;

    let today = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM product_views WHERE product_id = $1 AND viewed_at::date = CURRENT_DATE",
    )
    .bind(product_id)
    .fetch_one(&state.db)
    .await?;

    let weekly = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM product_views WHERE product_id = $1 AND viewed_at >= CURRENT_DATE - 7",
    )
    .bind(product_id)
    .fetch_one(&state.db)
    .await?;

    // 전환율: 해당 상품의 주문 수 / 조회수
    let order_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT o.id) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = $1 AND o.status NOT IN ('cancelled', 'refunded')",
    )
    .bind(product_id)
    .fetch_one(&state.db)
    .await?;

    let conversion_rate = if total > 0 {
        (order_count as f64 / total as f64 * 100.0 * 100.0).round() / 100.0
    } else {
        0.0
    };

    Ok(Json(serde_json::json!({
        "data": {
            "total_views": total,
            "today_views": today,
            "weekly_views": weekly,
            "order_count": order_count,
            "conversion_rate": conversion_rate,
        }
    })))
}

// --- Bulk Status/Price JSON Endpoints (FR-C11) ---

#[derive(serde::Deserialize)]
struct BulkStatusRequest {
    product_ids: Vec<Uuid>,
    status: String,
}

/// PUT /api/seller/products/bulk-status — FR-C11
async fn bulk_status_change(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<BulkStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let valid = ["active", "inactive", "sold_out"];
    if !valid.contains(&req.status.as_str()) {
        return Err(AppError::Validation {
            message: "status must be: active, inactive, sold_out".into(),
            field: Some("status".into()),
        });
    }
    if req.product_ids.len() > 100 {
        return Err(AppError::Validation {
            message: "Maximum 100 products at a time".into(),
            field: Some("product_ids".into()),
        });
    }

    let is_active = req.status == "active";
    let mut updated = 0u64;
    for pid in &req.product_ids {
        let r = sqlx::query(
            "UPDATE products SET is_active = $2, updated_at = NOW() WHERE id = $1 AND seller_id = $3",
        )
        .bind(pid)
        .bind(is_active)
        .bind(auth.id)
        .execute(&state.db)
        .await?;
        updated += r.rows_affected();
    }

    Ok(Json(
        serde_json::json!({ "data": { "updated_count": updated } }),
    ))
}

#[derive(serde::Deserialize)]
struct BulkPriceRequest {
    product_ids: Vec<Uuid>,
    adjustment_type: String, // percent | fixed
    adjustment_value: f64,
}

/// PUT /api/seller/products/bulk-price — FR-C11
async fn bulk_price_change(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<BulkPriceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.adjustment_type != "percent" && req.adjustment_type != "fixed" {
        return Err(AppError::Validation {
            message: "adjustment_type must be 'percent' or 'fixed'".into(),
            field: Some("adjustment_type".into()),
        });
    }
    if req.product_ids.len() > 100 {
        return Err(AppError::Validation {
            message: "Maximum 100 products".into(),
            field: Some("product_ids".into()),
        });
    }

    let mut updated = 0u64;
    for pid in &req.product_ids {
        let sql = if req.adjustment_type == "percent" {
            "UPDATE products SET price = price * (1 + $2 / 100.0), updated_at = NOW() WHERE id = $1 AND seller_id = $3 AND price * (1 + $2 / 100.0) > 0"
        } else {
            "UPDATE products SET price = price + $2, updated_at = NOW() WHERE id = $1 AND seller_id = $3 AND price + $2 > 0"
        };
        let r = sqlx::query(sql)
            .bind(pid)
            .bind(bigdecimal::BigDecimal::try_from(req.adjustment_value).unwrap_or_default())
            .bind(auth.id)
            .execute(&state.db)
            .await?;
        updated += r.rows_affected();
    }

    Ok(Json(
        serde_json::json!({ "data": { "updated_count": updated } }),
    ))
}

// --- Excel Export Endpoints ---

#[derive(serde::Deserialize)]
struct ExportQuery {
    start_date: Option<String>,
    end_date: Option<String>,
    // API 계약 보존: 프론트 status 필터 파라미터. 현재 SQL 은 전체
    // export 만 지원. 향후 status별 export 도입 시 사용.
    #[allow(dead_code)]
    status: Option<String>,
}

/// GET /api/seller/orders/export — FR-C09
async fn export_orders(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<ExportQuery>,
) -> Result<(axum::http::StatusCode, axum::http::HeaderMap, Vec<u8>), AppError> {
    use rust_xlsxwriter::*;

    let start = query
        .start_date
        .as_deref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .unwrap_or(chrono::Utc::now().date_naive() - chrono::Duration::days(90));
    let end = query
        .end_date
        .as_deref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .unwrap_or(chrono::Utc::now().date_naive());

    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<String>,
            i32,
            bigdecimal::BigDecimal,
            String,
            String,
        ),
    >(
        r#"SELECT o.order_number, COALESCE(u.nickname, u.username),
                  p.title, oi.option_snapshot::text,
                  oi.quantity, oi.subtotal,
                  o.status, o.created_at::text
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           JOIN users u ON u.id = o.buyer_id
           WHERE oi.seller_id = $1
             AND o.created_at::date BETWEEN $2 AND $3
           ORDER BY o.created_at DESC
           LIMIT 5000"#,
    )
    .bind(auth.id)
    .bind(start)
    .bind(end)
    .fetch_all(&state.db)
    .await?;

    let mut workbook = Workbook::new();
    let ws = workbook.add_worksheet();
    let headers = [
        "주문번호",
        "구매자",
        "상품명",
        "옵션",
        "수량",
        "금액",
        "상태",
        "주문일시",
    ];
    for (c, h) in headers.iter().enumerate() {
        let _ = ws.write_string(0, c as u16, *h);
    }
    for (r, row) in rows.iter().enumerate() {
        let r = (r + 1) as u32;
        let _ = ws.write_string(r, 0, &row.0);
        let _ = ws.write_string(r, 1, &row.1);
        let _ = ws.write_string(r, 2, &row.2);
        let _ = ws.write_string(r, 3, row.3.as_deref().unwrap_or(""));
        let _ = ws.write_number(r, 4, row.4 as f64);
        let _ = ws.write_string(r, 5, row.5.to_string());
        let _ = ws.write_string(r, 6, &row.6);
        let _ = ws.write_string(r, 7, &row.7);
    }

    let buf = workbook
        .save_to_buffer()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?;
    let mut hm = axum::http::HeaderMap::new();
    hm.insert(
        axum::http::header::CONTENT_TYPE,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            .parse()
            .unwrap(),
    );
    hm.insert(
        axum::http::header::CONTENT_DISPOSITION,
        "attachment; filename=\"orders_export.xlsx\""
            .parse()
            .unwrap(),
    );
    Ok((axum::http::StatusCode::OK, hm, buf))
}

/// GET /api/seller/settlement/export — FR-C10
async fn export_settlements(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(_query): Query<ExportQuery>,
) -> Result<(axum::http::StatusCode, axum::http::HeaderMap, Vec<u8>), AppError> {
    use rust_xlsxwriter::*;

    let rows = sqlx::query_as::<
        _,
        (
            String,
            bigdecimal::BigDecimal,
            bigdecimal::BigDecimal,
            bigdecimal::BigDecimal,
            String,
            String,
        ),
    >(
        r#"SELECT s.settlement_number,
                  s.total_amount, s.fee_amount, s.net_amount,
                  s.status, s.created_at::text
           FROM settlements s
           WHERE s.seller_id = $1
           ORDER BY s.created_at DESC
           LIMIT 5000"#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;

    let mut workbook = Workbook::new();
    let ws = workbook.add_worksheet();
    let headers = ["정산번호", "총액", "수수료", "정산액", "상태", "정산일"];
    for (c, h) in headers.iter().enumerate() {
        let _ = ws.write_string(0, c as u16, *h);
    }
    for (r, row) in rows.iter().enumerate() {
        let r = (r + 1) as u32;
        let _ = ws.write_string(r, 0, &row.0);
        let _ = ws.write_string(r, 1, row.1.to_string());
        let _ = ws.write_string(r, 2, row.2.to_string());
        let _ = ws.write_string(r, 3, row.3.to_string());
        let _ = ws.write_string(r, 4, &row.4);
        let _ = ws.write_string(r, 5, &row.5);
    }

    let buf = workbook
        .save_to_buffer()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?;
    let mut hm = axum::http::HeaderMap::new();
    hm.insert(
        axum::http::header::CONTENT_TYPE,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            .parse()
            .unwrap(),
    );
    hm.insert(
        axum::http::header::CONTENT_DISPOSITION,
        "attachment; filename=\"settlement_export.xlsx\""
            .parse()
            .unwrap(),
    );
    Ok((axum::http::StatusCode::OK, hm, buf))
}

// --- Draft / Schedule Endpoints ---

/// POST /api/products/{id}/draft — FR-C06
async fn save_draft(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query(
        "UPDATE products SET is_draft = true, is_active = false, updated_at = NOW() WHERE id = $1 AND seller_id = $2",
    )
    .bind(product_id)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Product not found or not owned".into()));
    }
    Ok(Json(serde_json::json!({ "data": { "is_draft": true } })))
}

#[derive(serde::Deserialize)]
struct ScheduleRequest {
    scheduled_at: chrono::DateTime<chrono::Utc>,
}

/// POST /api/products/{id}/schedule — FR-C04
async fn schedule_product(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(product_id): Path<Uuid>,
    Json(req): Json<ScheduleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.scheduled_at <= chrono::Utc::now() {
        return Err(AppError::Validation {
            message: "scheduled_at must be in the future".into(),
            field: Some("scheduled_at".into()),
        });
    }

    let result = sqlx::query(
        "UPDATE products SET scheduled_at = $2, is_active = false, updated_at = NOW() WHERE id = $1 AND seller_id = $3",
    )
    .bind(product_id)
    .bind(req.scheduled_at)
    .bind(auth.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Product not found or not owned".into()));
    }
    Ok(Json(
        serde_json::json!({ "data": { "scheduled_at": req.scheduled_at } }),
    ))
}
