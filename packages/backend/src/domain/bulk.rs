use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct BulkUploadLog {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub upload_type: String,
    pub file_name: String,
    pub total_rows: i32,
    pub success_count: i32,
    pub error_count: i32,
    pub error_details: Option<serde_json::Value>,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct BulkUploadParams {
    pub upload_type: String, // create, update, status, price
}

#[derive(Debug, Serialize)]
pub struct BulkUploadResult {
    pub log_id: Uuid,
    pub total_rows: i32,
    pub success_count: i32,
    pub error_count: i32,
    pub errors: Vec<BulkRowError>,
}

#[derive(Debug, Serialize)]
pub struct BulkRowError {
    pub row: i32,
    pub field: String,
    pub message: String,
}

// Product view tracking
#[derive(Debug, Serialize)]
pub struct ProductViewStats {
    pub total_views: i64,
    pub today_views: i64,
    pub weekly_views: i64,
}
