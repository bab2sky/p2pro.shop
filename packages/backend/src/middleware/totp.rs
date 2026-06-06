use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm as Argon2Algorithm, Argon2, Params, Version};
use rand::RngCore;
use sqlx::PgPool;
use totp_rs::{Algorithm, Secret, TOTP};
use uuid::Uuid;

use crate::AppError;

// Internal row type for querying user_totp
#[derive(Debug, sqlx::FromRow)]
struct TotpRow {
    id: Uuid,
    secret_encrypted: String,
    is_enabled: Option<bool>,
    backup_codes: Option<Vec<String>>,
}

/// Verify a TOTP code (or backup code) for a given user against the database.
///
/// Returns `Ok(true)` if the code is valid.
/// Returns an error if 2FA is not set up, not enabled, or the code is invalid.
pub async fn verify_totp(
    db: &PgPool,
    user_id: Uuid,
    code: &str,
    encryption_key: &str,
) -> Result<bool, AppError> {
    // Fetch user_totp record
    let totp_record = sqlx::query_as::<_, TotpRow>(
        "SELECT id, secret_encrypted, is_enabled, backup_codes FROM user_totp WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(db)
    .await?;

    let totp_record = totp_record.ok_or_else(|| AppError::Validation {
        message: "2FA 설정이 필요합니다".to_string(),
        field: Some("totp".to_string()),
    })?;

    if !totp_record.is_enabled.unwrap_or(false) {
        return Err(AppError::Validation {
            message: "2FA 설정이 필요합니다".to_string(),
            field: Some("totp".to_string()),
        });
    }

    // Decrypt the stored secret and try TOTP code validation
    let secret = decrypt_totp_secret(&totp_record.secret_encrypted, encryption_key)?;
    if verify_totp_code(&secret, code)? {
        return Ok(true);
    }

    // Try backup codes if TOTP code didn't match (with row-level lock to prevent TOCTOU)
    {
        let mut tx = db.begin().await?;

        let locked_record = sqlx::query_as::<_, TotpRow>(
            "SELECT id, secret_encrypted, is_enabled, backup_codes FROM user_totp WHERE id = $1 FOR UPDATE",
        )
        .bind(totp_record.id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(locked) = locked_record {
            if let Some(ref backup_codes) = locked.backup_codes {
                for (idx, hashed_code) in backup_codes.iter().enumerate() {
                    if hashed_code.is_empty() {
                        continue; // already used
                    }
                    if verify_backup_code(code, hashed_code) {
                        // Mark this backup code as used by setting it to empty string
                        let mut updated_codes = backup_codes.clone();
                        updated_codes[idx] = String::new();
                        sqlx::query(
                            "UPDATE user_totp SET backup_codes = $1, updated_at = NOW() WHERE id = $2",
                        )
                        .bind(&updated_codes)
                        .bind(locked.id)
                        .execute(&mut *tx)
                        .await?;
                        tx.commit().await?;
                        return Ok(true);
                    }
                }
            }
        }

        tx.commit().await?;
    }

    Err(AppError::Unauthorized(
        "2FA 코드가 올바르지 않습니다".to_string(),
    ))
}

/// Encrypt a TOTP secret with AES-256-GCM.
/// `key_hex` must be a 64-character hex string (32 bytes).
/// Returns a hex-encoded string: nonce(12 bytes) || ciphertext.
pub fn encrypt_totp_secret(plaintext: &str, key_hex: &str) -> Result<String, AppError> {
    let key_bytes = hex::decode(key_hex).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Invalid TOTP encryption key hex: {}", e))
    })?;
    if key_bytes.len() != 32 {
        return Err(AppError::Internal(anyhow::anyhow!(
            "TOTP encryption key must be 32 bytes (64 hex chars)"
        )));
    }

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create AES cipher: {}", e)))?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("TOTP secret encryption failed: {}", e)))?;

    // Concatenate nonce + ciphertext, hex-encode
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);
    Ok(hex::encode(result))
}

/// Decrypt a TOTP secret encrypted with AES-256-GCM.
/// Input is hex-encoded: nonce(12 bytes) || ciphertext.
pub fn decrypt_totp_secret(encrypted_hex: &str, key_hex: &str) -> Result<String, AppError> {
    let key_bytes = hex::decode(key_hex).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Invalid TOTP encryption key hex: {}", e))
    })?;
    if key_bytes.len() != 32 {
        return Err(AppError::Internal(anyhow::anyhow!(
            "TOTP encryption key must be 32 bytes (64 hex chars)"
        )));
    }

    let data = hex::decode(encrypted_hex)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid encrypted hex data: {}", e)))?;
    if data.len() < 12 {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Invalid encrypted data: too short"
        )));
    }

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create AES cipher: {}", e)))?;

    let nonce = Nonce::from_slice(&data[..12]);
    let ciphertext = &data[12..];

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("TOTP secret decryption failed: {}", e)))?;

    String::from_utf8(plaintext).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Decrypted TOTP secret is not UTF-8: {}", e))
    })
}

/// Verify a TOTP code against a base32-encoded secret (pure, no DB).
pub fn verify_totp_code(secret_base32: &str, code: &str) -> Result<bool, AppError> {
    let totp = build_totp(secret_base32)?;
    Ok(totp.check_current(code).unwrap_or(false))
}

/// Build a TOTP instance from a base32-encoded secret.
fn build_totp(base32_secret: &str) -> Result<TOTP, AppError> {
    let secret = Secret::Encoded(base32_secret.to_string())
        .to_bytes()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid TOTP secret: {}", e)))?;

    TOTP::new(Algorithm::SHA1, 6, 1, 30, secret, None, String::new())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to build TOTP: {}", e)))
}

/// Generate a new TOTP secret and return (secret_base32, otpauth_url).
pub fn generate_totp_secret(
    issuer: &str,
    account_name: &str,
) -> Result<(String, String), AppError> {
    let secret = Secret::generate_secret();
    let secret_base32 = secret.to_encoded().to_string();

    let secret_bytes = secret
        .to_bytes()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Secret conversion failed: {}", e)))?;

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some(issuer.to_string()),
        account_name.to_string(),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("TOTP creation failed: {}", e)))?;

    let qr_url = totp.get_url();

    Ok((secret_base32, qr_url))
}

/// Generate random backup codes (8-digit numeric strings).
pub fn generate_backup_codes(count: usize) -> Vec<String> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..count)
        .map(|_| format!("{:08}", rng.gen_range(0..100_000_000u32)))
        .collect()
}

/// Argon2id with password-grade params (matches auth.rs hash_password).
/// Audit Security M-4 (2026-05-07): backup codes 는 8자리 숫자라 brute force 가
/// 빠르므로 default (m=19MB, t=2) 보다 강한 m=64MB, t=3 사용.
fn backup_code_hasher() -> Argon2<'static> {
    let params = Params::new(65536, 3, 1, None).expect("valid argon2 params");
    Argon2::new(Argon2Algorithm::Argon2id, Version::V0x13, params)
}

/// Hash a backup code using argon2 for secure storage.
/// Returns "salt_hex:hash_hex" format.
pub fn hash_backup_code(code: &str) -> Result<String, AppError> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let mut output = [0u8; 32];
    backup_code_hasher()
        .hash_password_into(code.as_bytes(), &salt, &mut output)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Backup code hashing failed: {}", e)))?;
    Ok(format!("{}:{}", hex::encode(salt), hex::encode(output)))
}

/// Verify a plaintext backup code against its stored argon2 hash.
fn verify_backup_code(code: &str, stored: &str) -> bool {
    let parts: Vec<&str> = stored.splitn(2, ':').collect();
    if parts.len() != 2 {
        return false;
    }
    let salt = match hex::decode(parts[0]) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let expected_hash = match hex::decode(parts[1]) {
        Ok(h) => h,
        Err(_) => return false,
    };
    let mut output = [0u8; 32];
    if backup_code_hasher()
        .hash_password_into(code.as_bytes(), &salt, &mut output)
        .is_err()
    {
        return false;
    }
    // M-3 FIX: Use constant-time comparison to prevent timing attacks
    constant_time_eq(&output[..], &expected_hash[..])
}

/// Constant-time byte comparison to prevent timing side-channel attacks
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}
