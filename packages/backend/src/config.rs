use anyhow::Result;

#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_refresh_secret: String,
    pub jwt_expiry_hours: i64,
    pub jwt_refresh_expiry_days: i64,
    pub server_port: u16,
    pub company_wallet_address: String,
    pub etherscan_api_key: String,
    pub trongrid_api_key: String,
    pub company_wallet_eth: String,
    pub company_wallet_tron: String,
    pub txid_auto_cancel_hours: i64,
    pub udg_webhook_url: String,
    pub udg_webhook_secret: String,
    pub upload_dir: String,
    pub max_upload_size_mb: usize,
    pub commission_rate: String,
    pub min_settlement_amount: String,
    pub totp_issuer: String,
    pub totp_encryption_key: String,
    pub webhook_max_retries: u32,
    pub dispute_max_per_month: u32,
    pub allowed_origins: Vec<String>,
    pub log_format: String,
    // Phase 8: Social Login
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,
    pub kakao_client_id: String,
    pub kakao_client_secret: String,
    pub kakao_redirect_uri: String,
    pub oauth_frontend_callback_url: String,
    // Phase 8: Delivery Tracking
    pub sweettracker_api_key: String,
    pub sweettracker_api_url: String,
    // Phase 8: Email
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_username: String,
    pub smtp_password: String,
    pub smtp_from_email: String,
    pub smtp_from_name: String,
    pub smtp_use_tls: bool,
}

impl std::fmt::Debug for AppConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppConfig")
            .field("server_port", &self.server_port)
            .field("jwt_expiry_hours", &self.jwt_expiry_hours)
            .field("jwt_refresh_expiry_days", &self.jwt_refresh_expiry_days)
            .field("txid_auto_cancel_hours", &self.txid_auto_cancel_hours)
            .field("upload_dir", &self.upload_dir)
            .field("max_upload_size_mb", &self.max_upload_size_mb)
            .field("commission_rate", &self.commission_rate)
            .field("min_settlement_amount", &self.min_settlement_amount)
            .field("totp_issuer", &self.totp_issuer)
            .field("webhook_max_retries", &self.webhook_max_retries)
            .field("dispute_max_per_month", &self.dispute_max_per_month)
            .field("allowed_origins", &self.allowed_origins)
            .field("log_format", &self.log_format)
            .field("smtp_port", &self.smtp_port)
            .field("smtp_from_email", &self.smtp_from_email)
            .field("smtp_from_name", &self.smtp_from_name)
            .field("smtp_use_tls", &self.smtp_use_tls)
            .field("database_url", &"[REDACTED]")
            .field("redis_url", &"[REDACTED]")
            .field("jwt_secret", &"[REDACTED]")
            .field("jwt_refresh_secret", &"[REDACTED]")
            .field("etherscan_api_key", &"[REDACTED]")
            .field("trongrid_api_key", &"[REDACTED]")
            .field("totp_encryption_key", &"[REDACTED]")
            .field("udg_webhook_secret", &"[REDACTED]")
            .field("google_client_secret", &"[REDACTED]")
            .field("kakao_client_secret", &"[REDACTED]")
            .field("sweettracker_api_key", &"[REDACTED]")
            .field("smtp_password", &"[REDACTED]")
            .finish()
    }
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        let config = Self {
            database_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".into()),
            jwt_secret: std::env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            jwt_refresh_secret: std::env::var("JWT_REFRESH_SECRET")
                .expect("JWT_REFRESH_SECRET must be set"),
            jwt_expiry_hours: 1,
            jwt_refresh_expiry_days: 7,
            server_port: std::env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()
                .unwrap_or(8080),
            company_wallet_address: std::env::var("COMPANY_WALLET_ADDRESS").unwrap_or_default(),
            etherscan_api_key: std::env::var("ETHERSCAN_API_KEY").unwrap_or_default(),
            trongrid_api_key: std::env::var("TRONGRID_API_KEY").unwrap_or_default(),
            company_wallet_eth: std::env::var("COMPANY_WALLET_ETH").unwrap_or_default(),
            company_wallet_tron: std::env::var("COMPANY_WALLET_TRON").unwrap_or_default(),
            txid_auto_cancel_hours: std::env::var("TXID_AUTO_CANCEL_HOURS")
                .unwrap_or_else(|_| "24".into())
                .parse()
                .unwrap_or(24),
            udg_webhook_url: std::env::var("UDG_WEBHOOK_URL").unwrap_or_default(),
            udg_webhook_secret: std::env::var("UDG_WEBHOOK_SECRET").unwrap_or_default(),
            upload_dir: std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".into()),
            max_upload_size_mb: std::env::var("MAX_UPLOAD_SIZE_MB")
                .unwrap_or_else(|_| "5".into())
                .parse()
                .unwrap_or(5),
            commission_rate: std::env::var("COMMISSION_RATE").unwrap_or_else(|_| "0.05".into()),
            min_settlement_amount: std::env::var("MIN_SETTLEMENT_AMOUNT")
                .unwrap_or_else(|_| "10000".into()),
            totp_issuer: std::env::var("TOTP_ISSUER").unwrap_or_else(|_| "P2PRO Store".into()),
            totp_encryption_key: std::env::var("TOTP_ENCRYPTION_KEY").unwrap_or_default(),
            webhook_max_retries: std::env::var("WEBHOOK_MAX_RETRIES")
                .unwrap_or_else(|_| "5".into())
                .parse()
                .unwrap_or(5),
            dispute_max_per_month: std::env::var("DISPUTE_MAX_PER_MONTH")
                .unwrap_or_else(|_| "3".into())
                .parse()
                .unwrap_or(3),
            allowed_origins: std::env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:5173".into())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            log_format: std::env::var("RUST_LOG_FORMAT").unwrap_or_else(|_| "text".into()),
            // Phase 8: Social Login
            google_client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            google_client_secret: std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
            google_redirect_uri: std::env::var("GOOGLE_REDIRECT_URI").unwrap_or_default(),
            kakao_client_id: std::env::var("KAKAO_CLIENT_ID").unwrap_or_default(),
            kakao_client_secret: std::env::var("KAKAO_CLIENT_SECRET").unwrap_or_default(),
            kakao_redirect_uri: std::env::var("KAKAO_REDIRECT_URI").unwrap_or_default(),
            oauth_frontend_callback_url: std::env::var("OAUTH_FRONTEND_CALLBACK_URL")
                .unwrap_or_else(|_| "http://localhost:5173/oauth/callback".into()),
            // Phase 8: Delivery Tracking
            sweettracker_api_key: std::env::var("SWEETTRACKER_API_KEY").unwrap_or_default(),
            sweettracker_api_url: std::env::var("SWEETTRACKER_API_URL")
                .unwrap_or_else(|_| "http://info.sweettracker.co.kr/api/v1".into()),
            // Phase 8: Email
            smtp_host: std::env::var("SMTP_HOST").unwrap_or_default(),
            smtp_port: std::env::var("SMTP_PORT")
                .unwrap_or_else(|_| "587".into())
                .parse()
                .unwrap_or(587),
            smtp_username: std::env::var("SMTP_USERNAME").unwrap_or_default(),
            smtp_password: std::env::var("SMTP_PASSWORD").unwrap_or_default(),
            smtp_from_email: std::env::var("SMTP_FROM_EMAIL")
                .unwrap_or_else(|_| "noreply@p2pro.store".into()),
            smtp_from_name: std::env::var("SMTP_FROM_NAME")
                .unwrap_or_else(|_| "P2PRO Store".into()),
            smtp_use_tls: std::env::var("SMTP_USE_TLS")
                .unwrap_or_else(|_| "true".into())
                .parse()
                .unwrap_or(true),
        };

        // Startup warnings for optional but important config
        if config.totp_encryption_key.is_empty() {
            tracing::warn!("TOTP_ENCRYPTION_KEY is not set - 2FA will not work correctly");
        }
        if config.company_wallet_address.is_empty() {
            tracing::warn!("COMPANY_WALLET_ADDRESS is not set");
        }
        if config.company_wallet_eth.is_empty() {
            tracing::warn!("COMPANY_WALLET_ETH is not set");
        }
        if config.company_wallet_tron.is_empty() {
            tracing::warn!("COMPANY_WALLET_TRON is not set");
        }

        config.validate()?;
        Ok(config)
    }

    /// FR-01, FR-02: Validate security-critical configuration
    fn validate(&self) -> Result<()> {
        // FR-02: Reject empty or short secrets.
        if self.jwt_secret.trim().is_empty() || self.jwt_secret.len() < 32 {
            anyhow::bail!("JWT_SECRET must be at least 32 characters");
        }
        if self.jwt_refresh_secret.trim().is_empty() || self.jwt_refresh_secret.len() < 32 {
            anyhow::bail!("JWT_REFRESH_SECRET must be at least 32 characters");
        }
        // LOW backlog (Audit Security H-1): hardening 권장 — 64자 (512 bits, hex).
        // 운영 폭발 방지를 위해 강제 X, warning 만. secret rotate 후 minimum 을 64 로 올림.
        // 새 secret 생성: `openssl rand -hex 32`
        if self.jwt_secret.len() < 64 {
            tracing::warn!(
                "JWT_SECRET length {} < 64 chars (HMAC-SHA256 hardening recommended). \
                 Rotate to 64-char secret: `openssl rand -hex 32`",
                self.jwt_secret.len()
            );
        }
        if self.jwt_refresh_secret.len() < 64 {
            tracing::warn!(
                "JWT_REFRESH_SECRET length {} < 64 chars (HMAC-SHA256 hardening recommended). \
                 Rotate to 64-char secret: `openssl rand -hex 32`",
                self.jwt_refresh_secret.len()
            );
        }

        let is_prod = std::env::var("RUST_ENV").unwrap_or_default() == "production";
        if is_prod {
            // FR-01: Reject wildcard CORS in production
            if self.allowed_origins.iter().any(|o| o == "*") {
                anyhow::bail!(
                    "CORS wildcard '*' is not allowed in production. Set ALLOWED_ORIGINS explicitly."
                );
            }
            // FR-02: Production-required secrets
            if self.totp_encryption_key.trim().is_empty() {
                anyhow::bail!("TOTP_ENCRYPTION_KEY is required in production");
            }
            if self.udg_webhook_secret.is_empty() {
                anyhow::bail!("UDG_WEBHOOK_SECRET is required in production");
            }
            if self.company_wallet_address.trim().is_empty() {
                anyhow::bail!("COMPANY_WALLET_ADDRESS is required in production");
            }
            if self.company_wallet_eth.trim().is_empty() {
                anyhow::bail!("COMPANY_WALLET_ETH is required in production");
            }
            if self.company_wallet_tron.trim().is_empty() {
                anyhow::bail!("COMPANY_WALLET_TRON is required in production");
            }
            if self.etherscan_api_key.trim().is_empty() {
                anyhow::bail!("ETHERSCAN_API_KEY is required in production");
            }
            if self.trongrid_api_key.trim().is_empty() {
                anyhow::bail!("TRONGRID_API_KEY is required in production");
            }
        }

        Ok(())
    }
}
