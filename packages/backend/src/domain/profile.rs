use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- User Profile ---

#[derive(Debug, Serialize, FromRow)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
    pub nickname: Option<String>,
    pub profile_image: Option<String>,
    pub role: String,
    pub account_status: Option<String>,
    pub notification_settings: Option<serde_json::Value>,
    pub totp_enabled: Option<bool>,
    pub referral_code: String,
    pub referral_count: i64,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ProfileUpdateRequest {
    pub nickname: Option<String>,
    pub profile_image: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PasswordChangeRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct NotificationSettingsRequest {
    pub order: Option<bool>,
    pub chat: Option<bool>,
    pub shipping: Option<bool>,
    pub notice: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct DeactivateRequest {
    pub totp_code: String,
    /// FR-23: 2FA 미설정 시 비밀번호 필수
    pub password: Option<String>,
    pub reason: Option<String>,
}

// --- TOTP ---

#[derive(Debug, Serialize, FromRow)]
pub struct UserTotp {
    pub id: Uuid,
    pub user_id: Uuid,
    pub secret_encrypted: String,
    pub is_enabled: Option<bool>,
    pub backup_codes: Option<Vec<String>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct TotpSetupResponse {
    pub secret: String,
    pub qr_url: String,
    pub backup_codes: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct TotpVerifyRequest {
    pub code: String,
}

// --- User Wallet ---

#[derive(Debug, Serialize, FromRow)]
pub struct UserWallet {
    pub id: Uuid,
    pub user_id: Uuid,
    pub label: String,
    pub network: String,
    pub address: String,
    pub is_default: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct WalletCreateRequest {
    pub label: Option<String>,
    pub network: String,
    pub address: String,
    pub totp_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WalletChangeRequest {
    pub name: String,
    pub phone: String,
    pub current_address: String,
    pub new_address: String,
    pub network: String,
}

#[derive(Debug, Deserialize)]
pub struct WalletDeleteRequest {
    pub totp_code: String,
}

// --- Notification Settings (value object) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSettings {
    #[serde(default = "default_true")]
    pub order: bool,
    #[serde(default = "default_true")]
    pub chat: bool,
    #[serde(default = "default_true")]
    pub shipping: bool,
    #[serde(default = "default_true")]
    pub notice: bool,
}

fn default_true() -> bool {
    true
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            order: true,
            chat: true,
            shipping: true,
            notice: true,
        }
    }
}
