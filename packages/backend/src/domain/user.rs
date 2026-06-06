use chrono::{DateTime, Utc};
use ipnetwork::IpNetwork;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// FR-07: UserRole enum — replaces magic string comparisons
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    User,
    Buyer,
    Seller,
    Admin,
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for UserRole {
    fn decode(value: sqlx::postgres::PgValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        let s = <String as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        Ok(Self::from_str_lossy(&s))
    }
}

impl sqlx::Encode<'_, sqlx::Postgres> for UserRole {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> Result<sqlx::encode::IsNull, sqlx::error::BoxDynError> {
        <String as sqlx::Encode<sqlx::Postgres>>::encode(self.to_string(), buf)
    }
}

impl sqlx::Type<sqlx::Postgres> for UserRole {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <String as sqlx::Type<sqlx::Postgres>>::type_info()
    }

    fn compatible(ty: &sqlx::postgres::PgTypeInfo) -> bool {
        <String as sqlx::Type<sqlx::Postgres>>::compatible(ty)
    }
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::User => write!(f, "user"),
            UserRole::Buyer => write!(f, "buyer"),
            UserRole::Seller => write!(f, "seller"),
            UserRole::Admin => write!(f, "admin"),
        }
    }
}

impl UserRole {
    pub fn from_str_lossy(s: &str) -> Self {
        match s {
            "admin" => UserRole::Admin,
            "seller" => UserRole::Seller,
            "buyer" => UserRole::Buyer,
            _ => UserRole::User,
        }
    }
}

/// DDL 22 columns fully mapped
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub phone: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub real_name: String,
    pub nickname: Option<String>,
    pub profile_image: Option<String>,
    pub role: UserRole,
    pub is_email_verified: bool,
    pub is_phone_verified: bool,
    pub is_udg_member: bool,
    pub referral_code: String,
    pub referrer_id: Option<Uuid>,
    #[serde(skip_serializing)]
    pub totp_secret: Option<String>,
    pub is_2fa_enabled: bool,
    pub locale: Option<String>,
    pub theme: Option<String>,
    pub status: Option<String>,
    pub withdrawn_at: Option<DateTime<Utc>>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub last_login_ip: Option<IpNetwork>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// Mass-assignment 방어: 명시되지 않은 필드 (role, status, is_admin 등)
// 가 들어오면 거부. role 같은 권한 필드가 future 에 struct 에 추가될 가능성
// 차단 + 알 수 없는 필드 명시적 알림.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub real_name: Option<String>,
    pub nickname: Option<String>,
    pub phone: Option<String>,
    pub referrer_code: Option<String>,
    pub is_udg_member: Option<bool>,
    pub terms_agreed: bool,
    pub privacy_agreed: bool,
    pub marketing_agreed: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub totp_code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub data: AuthData,
}

#[derive(Debug, Serialize)]
pub struct AuthData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub user: UserProfile,
}

#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
    pub nickname: Option<String>,
    pub role: UserRole,
    pub phone: Option<String>,
    pub is_email_verified: bool,
    pub is_phone_verified: bool,
    pub is_udg_member: bool,
    pub is_2fa_enabled: bool,
    pub locale: Option<String>,
    pub theme: Option<String>,
    pub status: Option<String>,
    pub referral_code: String,
}

impl From<User> for UserProfile {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            email: u.email,
            nickname: u.nickname,
            role: u.role,
            phone: u.phone,
            is_email_verified: u.is_email_verified,
            is_phone_verified: u.is_phone_verified,
            is_udg_member: u.is_udg_member,
            is_2fa_enabled: u.is_2fa_enabled,
            locale: u.locale,
            theme: u.theme,
            status: u.status,
            referral_code: u.referral_code,
        }
    }
}
