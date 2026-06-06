use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_orders: i64,
    pub pending_payments: i64,
    pub pending_txid_verify: i64,
    pub pending_products: i64,
    pub total_revenue: BigDecimal,
    pub today_orders: i64,
    pub today_revenue: BigDecimal,
    pub active_sellers: i64,
    pub total_users: i64,
    // Extended stats
    pub shipped_orders: i64,
    pub delivered_orders: i64,
    pub confirmed_orders: i64,
    pub cancelled_orders: i64,
    pub new_users_7d: i64,
    pub total_products: i64,
    pub active_products: i64,
    pub open_disputes: i64,
    pub pending_refunds: i64,
    pub pending_withdrawals: i64,
    pub week_revenue: BigDecimal,
    pub month_revenue: BigDecimal,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RecentOrder {
    pub id: Uuid,
    pub order_number: String,
    pub buyer_name: String,
    pub total_amount: BigDecimal,
    pub status: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct PendingActions {
    pub products: i64,
    pub txid: i64,
    pub sellers: i64,
    pub refunds: i64,
    pub disputes: i64,
    pub withdrawals: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RecentActivity {
    pub action: String,
    pub target_type: String,
    pub detail: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct OrderStatusBreakdown {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub data: DashboardData,
}

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub stats: DashboardStats,
    pub recent_orders: Vec<RecentOrder>,
    pub pending_actions: PendingActions,
    pub order_status_breakdown: Vec<OrderStatusBreakdown>,
    pub recent_activities: Vec<RecentActivity>,
}

// Admin log entry
#[derive(Debug, Serialize, FromRow)]
pub struct AdminLogEntry {
    pub id: Uuid,
    pub admin_id: Uuid,
    pub action: String,
    pub target_type: String,
    pub target_id: Uuid,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    /// FR-08: Total count from COUNT(*) OVER() window function
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AdminLogListResponse {
    pub data: Vec<AdminLogEntry>,
    pub pagination: super::common::Pagination,
}

// Pending product for review (legacy — used by /products/pending)
#[derive(Debug, Serialize, FromRow)]
pub struct PendingProduct {
    pub id: Uuid,
    pub title: String,
    pub seller_name: String,
    pub price: Option<BigDecimal>,
    pub status: String,
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PendingProductListResponse {
    pub data: Vec<PendingProduct>,
    pub pagination: super::common::Pagination,
}

// Full admin product view (used by /products with filters)
#[derive(Debug, Serialize, FromRow)]
pub struct AdminProduct {
    pub id: Uuid,
    pub title: String,
    pub seller_name: String,
    #[sqlx(default)]
    pub seller_email: Option<String>,
    pub category_name: Option<String>,
    pub base_price: Option<BigDecimal>,
    pub margin_rate: Option<BigDecimal>,
    pub final_price: Option<BigDecimal>,
    pub shipping_fee: Option<BigDecimal>,
    pub stock: Option<i32>,
    pub sold_count: Option<i32>,
    pub view_count: Option<i32>,
    pub review_count: Option<i32>,
    pub avg_rating: Option<BigDecimal>,
    pub status: String,
    pub rejected_reason: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AdminProductListResponse {
    pub data: Vec<AdminProduct>,
    pub pagination: super::common::Pagination,
}

/// Product statistics for admin dashboard cards
#[derive(Debug, Serialize)]
pub struct ProductStats {
    pub total_products: i64,
    pub pending_products: i64,
    pub active_products: i64,
    pub rejected_products: i64,
    pub suspended_products: i64,
    pub today_new: i64,
    pub out_of_stock: i64,
    pub total_sold: i64,
}

/// Product status change request
#[derive(Debug, Deserialize)]
pub struct ProductStatusRequest {
    pub reason: Option<String>,
}

// Pending TXID verification
#[derive(Debug, Serialize, FromRow)]
pub struct PendingTxid {
    pub id: Uuid,
    pub order_id: Uuid,
    pub order_number: String,
    pub txid: String,
    pub buyer_name: String,
    pub total_amount: BigDecimal,
    pub verification_status: Option<String>,
    pub failure_reason: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PendingTxidListResponse {
    pub data: Vec<PendingTxid>,
    pub pagination: super::common::Pagination,
}

// Seller management
#[derive(Debug, Serialize, FromRow)]
pub struct SellerInfo {
    pub id: Uuid,
    pub user_id: Uuid,
    pub seller_type: String,
    pub contact_phone: Option<String>,
    pub seller_name: String,
    #[sqlx(default)]
    pub email: Option<String>,
    pub wallet_address: Option<String>,
    pub status: String,
    pub balance: Option<BigDecimal>,
    pub total_sales: Option<i32>,
    pub total_revenue: Option<BigDecimal>,
    pub avg_rating: Option<BigDecimal>,
    pub grade: Option<i16>,
    pub grade_score: Option<BigDecimal>,
    pub dispute_count: Option<i32>,
    pub rejected_reason: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SellerListResponse {
    pub data: Vec<SellerInfo>,
    pub pagination: super::common::Pagination,
}

/// Seller statistics for admin dashboard cards
#[derive(Debug, Serialize)]
pub struct SellerStats {
    pub total_sellers: i64,
    pub pending_sellers: i64,
    pub approved_sellers: i64,
    pub suspended_sellers: i64,
    pub rejected_sellers: i64,
    pub today_new: i64,
    pub total_revenue: BigDecimal,
    pub total_balance: BigDecimal,
}

// User management
#[derive(Debug, Serialize, FromRow)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub real_name: String,
    pub nickname: Option<String>,
    pub role: String,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub last_login_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub data: Vec<UserInfo>,
    pub pagination: super::common::Pagination,
}

// User detail (full profile for admin view)
#[derive(Debug, Serialize, FromRow)]
pub struct UserDetail {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub phone: Option<String>,
    pub real_name: String,
    pub nickname: Option<String>,
    pub profile_image: Option<String>,
    pub role: String,
    pub is_email_verified: bool,
    pub is_phone_verified: bool,
    pub is_udg_member: bool,
    pub is_2fa_enabled: bool,
    pub locale: Option<String>,
    pub status: Option<String>,
    pub withdrawn_at: Option<DateTime<Utc>>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub last_login_ip: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// User update request (admin)
#[derive(Debug, Deserialize)]
pub struct UserUpdateRequest {
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: Option<String>,
    pub nickname: Option<String>,
    pub status: Option<String>,
    pub is_email_verified: Option<bool>,
    pub is_phone_verified: Option<bool>,
    pub is_udg_member: Option<bool>,
    pub reset_2fa: Option<bool>,
}

// Seller profile info embedded in user detail
#[derive(Debug, Serialize, FromRow)]
pub struct UserSellerProfile {
    pub seller_id: Uuid,
    pub seller_type: String,
    pub wallet_address: String,
    pub contact_phone: Option<String>,
    pub deposit_amount: BigDecimal,
    pub balance: BigDecimal,
    pub total_sales: i32,
    pub total_revenue: BigDecimal,
    pub avg_rating: BigDecimal,
    pub response_rate: BigDecimal,
    pub avg_ship_days: BigDecimal,
    pub grade: i16,
    pub grade_score: BigDecimal,
    pub dispute_count: i32,
    pub seller_status: String,
    pub approved_at: Option<DateTime<Utc>>,
    pub seller_created_at: Option<DateTime<Utc>>,
}

// Seller grade info from seller_grades table
#[derive(Debug, Serialize, FromRow)]
pub struct UserSellerGrade {
    pub grade: String,
    pub score: BigDecimal,
    pub total_sales: i32,
    pub avg_rating: BigDecimal,
    pub response_rate: BigDecimal,
    pub dispute_rate: BigDecimal,
    pub calculated_at: Option<DateTime<Utc>>,
}

// Order statistics for user
#[derive(Debug, Serialize, FromRow)]
pub struct UserOrderStats {
    pub total_orders: i64,
    pub total_spent: BigDecimal,
    pub completed_orders: i64,
    pub cancelled_orders: i64,
}

// Request types
#[derive(Debug, Deserialize)]
pub struct RejectRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct TxidVerifyRequest {
    pub action: String, // "approve" | "reject"
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SellerStatusRequest {
    pub status: String, // "approved" | "suspended" | "rejected"
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SellerWalletUpdateRequest {
    pub wallet_address: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UserBlockRequest {
    pub blocked: bool,
}

#[derive(Debug, Deserialize)]
pub struct AdminSearchParams {
    pub q: Option<String>,
    pub status: Option<String>,
    pub role: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub sort: Option<String>,
}

impl AdminSearchParams {
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }
    pub fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(20).clamp(1, 100)
    }
    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.per_page()
    }
}

// --- Audit Log types (FR-28) ---

#[derive(Debug, Serialize, FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub admin_id: Uuid,
    pub admin_name: Option<String>,
    pub action: String,
    pub target_type: String,
    pub target_id: Option<Uuid>,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    /// FR-08: Total count from COUNT(*) OVER() window function
    #[serde(skip_serializing)]
    #[sqlx(default)]
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AuditLogListResponse {
    pub data: Vec<AuditLogEntry>,
    pub pagination: super::common::Pagination,
}

#[derive(Debug, Deserialize)]
pub struct AuditLogSearchParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub action: Option<String>,
    pub admin_id: Option<Uuid>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

impl AuditLogSearchParams {
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }
    pub fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(20).clamp(1, 100)
    }
    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.per_page()
    }
}

/// Helper to insert audit log entry (FR-28)
pub async fn log_audit_action(
    db: &sqlx::PgPool,
    admin_id: Uuid,
    action: &str,
    target_type: &str,
    target_id: Option<Uuid>,
    details: Option<serde_json::Value>,
    ip_address: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(Uuid::new_v4())
    .bind(admin_id)
    .bind(action)
    .bind(target_type)
    .bind(target_id)
    .bind(details)
    .bind(ip_address)
    .execute(db)
    .await?;
    Ok(())
}

/// Helper to insert admin log with optional IP address
pub async fn log_admin_action(
    db: &sqlx::PgPool,
    admin_id: Uuid,
    action: &str,
    target_type: &str,
    target_id: Uuid,
    details: Option<serde_json::Value>,
    ip_address: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7::INET)"#,
    )
    .bind(Uuid::new_v4())
    .bind(admin_id)
    .bind(action)
    .bind(target_type)
    .bind(target_id)
    .bind(details)
    .bind(ip_address)
    .execute(db)
    .await?;
    Ok(())
}
