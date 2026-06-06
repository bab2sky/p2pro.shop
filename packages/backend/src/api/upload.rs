use axum::{
    extract::{Multipart, State},
    routing::post,
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

use image::ImageFormat;

const ALLOWED_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE: usize = 5 * 1024 * 1024; // 5MB

pub fn router() -> Router<AppState> {
    Router::new().route("/upload", post(upload_image))
}

async fn upload_image(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut file_data: Option<Vec<u8>> = None;
    let mut content_type: Option<String> = None;
    let mut category = String::from("reviews");

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Multipart error: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                content_type = field.content_type().map(|s| s.to_string());
                let data = field.bytes().await.map_err(|e| {
                    AppError::Internal(anyhow::anyhow!("Failed to read field: {}", e))
                })?;
                file_data = Some(data.to_vec());
            }
            "category" => {
                let val = field.text().await.unwrap_or_default();
                if !val.is_empty() {
                    category = val;
                }
            }
            _ => {}
        }
    }

    let data = file_data.ok_or_else(|| AppError::Validation {
        message: "No file provided".into(),
        field: Some("file".into()),
    })?;

    let ct = content_type.unwrap_or_default();
    if !ALLOWED_TYPES.contains(&ct.as_str()) {
        return Err(AppError::Validation {
            message: "Only JPEG, PNG, WebP images are allowed".into(),
            field: Some("file".into()),
        });
    }

    // Validate magic bytes to prevent Content-Type spoofing
    let valid_magic = match ct.as_str() {
        "image/jpeg" => data.len() >= 2 && data[0] == 0xFF && data[1] == 0xD8,
        "image/png" => {
            data.len() >= 8 && data[..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        }
        "image/webp" => data.len() >= 12 && &data[..4] == b"RIFF" && &data[8..12] == b"WEBP",
        _ => false,
    };
    if !valid_magic {
        return Err(AppError::Validation {
            message: "File content does not match declared content type".into(),
            field: Some("file".into()),
        });
    }

    if data.len() > MAX_FILE_SIZE {
        return Err(AppError::Validation {
            message: "File size must be under 5MB".into(),
            field: Some("file".into()),
        });
    }

    // Validate category
    // 'products' 추가: 셀러 상품 등록/수정 페이지의 RichTextEditor 가 description 본문 이미지를 'products' 로 업로드한다.
    if ![
        "reviews", "banners", "disputes", "profiles", "chat", "products",
    ]
    .contains(&category.as_str())
    {
        return Err(AppError::Validation {
            message: "Invalid category. Must be 'reviews', 'banners', 'disputes', 'profiles', 'chat', or 'products'".into(),
            field: Some("category".into()),
        });
    }

    // Determine file extension
    let ext = match ct.as_str() {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "bin",
    };

    // Auto-convert JPEG/PNG to WebP if smaller
    let (final_data, final_ext) = if ct.as_str() != "image/webp" {
        convert_to_webp(&data, ext)
    } else {
        (data.clone(), ext)
    };

    let now = chrono::Utc::now();
    let year_month = now.format("%Y-%m").to_string();
    let file_id = Uuid::new_v4();
    let filename = format!("{}.{}", file_id, final_ext);

    let upload_base = state.config.upload_dir.clone();
    let dir_path = format!("{}/{}/{}", upload_base, category, year_month);

    tokio::fs::create_dir_all(&dir_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create upload dir: {}", e)))?;

    let file_path = format!("{}/{}", dir_path, filename);
    tokio::fs::write(&file_path, &final_data)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e)))?;

    let url = format!("/uploads/{}/{}/{}", category, year_month, filename);

    Ok(Json(serde_json::json!({
        "data": {
            "url": url,
            "filename": filename,
            "size": final_data.len(),
            "format": final_ext,
        }
    })))
}

/// Convert image bytes to WebP format.
/// Returns (webp_bytes, "webp") on success, or original (bytes, ext) on failure.
fn convert_to_webp<'a>(data: &[u8], original_ext: &'a str) -> (Vec<u8>, &'a str) {
    let img = match image::load_from_memory(data) {
        Ok(img) => img,
        Err(e) => {
            tracing::warn!("WebP conversion failed, using original: {}", e);
            return (data.to_vec(), original_ext);
        }
    };

    let mut webp_buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut webp_buf);

    match img.write_to(&mut cursor, ImageFormat::WebP) {
        Ok(()) => {
            if webp_buf.len() < data.len() {
                // WebP is leaked from 'a — we need a static str
                // Safe because "webp" is a static string
                (webp_buf, "webp")
            } else {
                (data.to_vec(), original_ext)
            }
        }
        Err(e) => {
            tracing::warn!("WebP encoding failed: {}", e);
            (data.to_vec(), original_ext)
        }
    }
}
