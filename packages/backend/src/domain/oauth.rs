// from_str → Option<Self> 패턴, FromStr trait 미구현 사유는 dispute.rs 와 동일.
#![allow(clippy::should_implement_trait)]

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OAuthProvider {
    Google,
    Kakao,
}

impl OAuthProvider {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "google" => Some(Self::Google),
            "kakao" => Some(Self::Kakao),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Google => "google",
            Self::Kakao => "kakao",
        }
    }

    pub fn auth_url(&self) -> &'static str {
        match self {
            Self::Google => "https://accounts.google.com/o/oauth2/v2/auth",
            Self::Kakao => "https://kauth.kakao.com/oauth/authorize",
        }
    }

    pub fn token_url(&self) -> &'static str {
        match self {
            Self::Google => "https://oauth2.googleapis.com/token",
            Self::Kakao => "https://kauth.kakao.com/oauth/token",
        }
    }

    pub fn userinfo_url(&self) -> &'static str {
        match self {
            Self::Google => "https://www.googleapis.com/oauth2/v2/userinfo",
            Self::Kakao => "https://kapi.kakao.com/v2/user/me",
        }
    }

    pub fn scopes(&self) -> &'static str {
        match self {
            Self::Google => "openid email profile",
            Self::Kakao => "profile_nickname profile_image account_email",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthUserInfo {
    pub provider: String,
    pub provider_user_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug)]
pub struct PkceChallenge {
    pub verifier: String,
    pub challenge: String,
    pub state: String,
}

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub token_type: String,
    #[allow(dead_code)]
    pub expires_in: Option<i64>,
    #[allow(dead_code)]
    pub refresh_token: Option<String>,
    #[allow(dead_code)]
    pub scope: Option<String>,
}

pub fn generate_pkce() -> PkceChallenge {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    use sha2::{Digest, Sha256};

    let verifier_bytes: [u8; 32] = rand::random();
    let verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);

    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    let state_bytes: [u8; 16] = rand::random();
    let state = URL_SAFE_NO_PAD.encode(state_bytes);

    PkceChallenge {
        verifier,
        challenge,
        state,
    }
}

pub async fn exchange_code(
    client: &reqwest::Client,
    provider: OAuthProvider,
    code: &str,
    code_verifier: &str,
    client_id: &str,
    client_secret: &str,
    redirect_uri: &str,
) -> anyhow::Result<TokenResponse> {
    let resp = client
        .post(provider.token_url())
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await?
        .json::<TokenResponse>()
        .await?;
    Ok(resp)
}

pub async fn fetch_userinfo(
    client: &reqwest::Client,
    provider: OAuthProvider,
    access_token: &str,
) -> anyhow::Result<OAuthUserInfo> {
    let resp = client
        .get(provider.userinfo_url())
        .bearer_auth(access_token)
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;

    match provider {
        OAuthProvider::Google => Ok(OAuthUserInfo {
            provider: "google".into(),
            provider_user_id: json["id"].as_str().unwrap_or_default().into(),
            email: json["email"].as_str().map(String::from),
            name: json["name"].as_str().map(String::from),
            avatar_url: json["picture"].as_str().map(String::from),
        }),
        OAuthProvider::Kakao => {
            let account = &json["kakao_account"];
            Ok(OAuthUserInfo {
                provider: "kakao".into(),
                provider_user_id: json["id"].to_string(),
                email: account["email"].as_str().map(String::from),
                name: json["properties"]["nickname"].as_str().map(String::from),
                avatar_url: json["properties"]["profile_image"]
                    .as_str()
                    .map(String::from),
            })
        }
    }
}

/// Resolve or create user from OAuth info.
/// Returns (user_id, role, is_udg_member, is_new_user).
pub async fn resolve_user(
    db: &sqlx::PgPool,
    info: &OAuthUserInfo,
) -> anyhow::Result<(Uuid, String, bool, bool)> {
    // 1. Check if social login already linked
    if let Some(row) = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM social_logins WHERE provider = $1 AND provider_user_id = $2",
    )
    .bind(&info.provider)
    .bind(&info.provider_user_id)
    .fetch_optional(db)
    .await?
    {
        sqlx::query("UPDATE social_logins SET last_login_at = NOW() WHERE provider = $1 AND provider_user_id = $2")
            .bind(&info.provider)
            .bind(&info.provider_user_id)
            .execute(db)
            .await?;

        // L-1 FIX: Check user is active on social re-login (prevent banned users from logging in via OAuth)
        let user = sqlx::query_as::<_, (String, bool, String)>(
            "SELECT role, is_udg_member, status FROM users WHERE id = $1",
        )
        .bind(row.0)
        .fetch_one(db)
        .await?;

        if user.2 != "active" {
            return Err(anyhow::anyhow!("Account is not active"));
        }

        return Ok((row.0, user.0, user.1, false));
    }

    // 2. Check if email already exists in users table -> auto-link
    // FR-04: is_email_verified 확인 후에만 자동 연결 (미인증 이메일은 자동 연결 거부)
    if let Some(email) = &info.email {
        if let Some(existing) = sqlx::query_as::<_, (Uuid, String, bool, bool)>(
            "SELECT id, role, is_udg_member, COALESCE(is_email_verified, false) FROM users WHERE email = $1 AND status = 'active'",
        )
        .bind(email)
        .fetch_optional(db)
        .await?
        {
            let (user_id, role, is_udg, is_email_verified) = existing;

            // FR-04: 이메일 미인증 사용자는 자동 연결하지 않고 새 계정 생성
            if !is_email_verified {
                // Fall through to create new user (section 3)
            } else {
                sqlx::query(
                    r#"INSERT INTO social_logins (user_id, provider, provider_user_id, provider_email, provider_name, provider_avatar_url, last_login_at)
                       VALUES ($1, $2, $3, $4, $5, $6, NOW())"#,
                )
                .bind(user_id)
                .bind(&info.provider)
                .bind(&info.provider_user_id)
                .bind(&info.email)
                .bind(&info.name)
                .bind(&info.avatar_url)
                .execute(db)
                .await?;

                return Ok((user_id, role, is_udg, false));
            }
        }
    }

    // 3. Create new user with random password
    let user_id = Uuid::new_v4();
    let random_password: [u8; 32] = rand::random();
    let password_hash = crate::api::auth::hash_password(&hex::encode(random_password))
        .map_err(|e| anyhow::anyhow!("Hash error: {}", e))?;

    let email = info
        .email
        .clone()
        .unwrap_or_else(|| format!("{}@social.p2pro.store", Uuid::new_v4()));
    let nickname = info.name.clone().unwrap_or_else(|| "User".into());
    let base_username = email.split('@').next().unwrap_or("user").to_string();
    let mut username = base_username.clone();
    let mut attempts = 0;
    loop {
        let exists =
            sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
                .bind(&username)
                .fetch_one(db)
                .await?;
        if !exists {
            break;
        }
        attempts += 1;
        if attempts > 5 {
            username = format!("user_{}", &Uuid::new_v4().to_string()[..8]);
            break;
        }
        let suffix: [u8; 2] = rand::random();
        username = format!("{}_{}", base_username, hex::encode(suffix));
    }

    sqlx::query(
        r#"INSERT INTO users (id, username, email, password_hash, nickname, role, is_udg_member, status)
           VALUES ($1, $2, $3, $4, $5, 'buyer', false, 'active')"#,
    )
    .bind(user_id)
    .bind(&username)
    .bind(&email)
    .bind(&password_hash)
    .bind(&nickname)
    .execute(db)
    .await?;

    sqlx::query(
        r#"INSERT INTO social_logins (user_id, provider, provider_user_id, provider_email, provider_name, provider_avatar_url, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())"#,
    )
    .bind(user_id)
    .bind(&info.provider)
    .bind(&info.provider_user_id)
    .bind(&info.email)
    .bind(&info.name)
    .bind(&info.avatar_url)
    .execute(db)
    .await?;

    Ok((user_id, "buyer".into(), false, true))
}
