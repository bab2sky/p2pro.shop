use sqlx::PgPool;
use uuid::Uuid;

/// Seed default admin user if no admin exists.
/// Admin credentials are read from environment variables:
///   ADMIN_EMAIL    (default: admin@p2pro.store)
///   ADMIN_PASSWORD (required in production, default: Admin1234! in dev)
///   ADMIN_NICKNAME (default: 관리자)
pub async fn seed_admin(pool: &PgPool) -> anyhow::Result<()> {
    // Check if any admin user already exists
    let admin_exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin')")
            .fetch_one(pool)
            .await?;

    if admin_exists {
        return Ok(());
    }

    // M-7: Production guard — require explicit ADMIN_PASSWORD in production
    let is_prod = std::env::var("RUST_ENV").unwrap_or_default() == "production";
    let password = match std::env::var("ADMIN_PASSWORD") {
        Ok(p) => p,
        Err(_) if is_prod => {
            anyhow::bail!(
                "ADMIN_PASSWORD must be set in production. Refusing to seed with default password."
            );
        }
        Err(_) => {
            tracing::warn!("Using default admin password — set ADMIN_PASSWORD for production!");
            "Admin1234@@".into()
        }
    };

    let email = std::env::var("ADMIN_EMAIL").unwrap_or_else(|_| "admin@p2pro.store".into());
    let nickname = std::env::var("ADMIN_NICKNAME").unwrap_or_else(|_| "관리자".into());

    // M-4: Use shared hash_password from auth module
    let password_hash = crate::api::auth::hash_password(&password)
        .map_err(|e| anyhow::anyhow!("Password hashing failed: {}", e))?;

    let user_id = Uuid::new_v4();
    let username = email.split('@').next().unwrap_or("admin").to_string();

    sqlx::query(
        r#"INSERT INTO users (id, username, email, password_hash, real_name, nickname, role, is_email_verified, status)
           VALUES ($1, $2, $3, $4, '관리자', $5, 'admin', true, 'active')"#,
    )
    .bind(user_id)
    .bind(&username)
    .bind(&email)
    .bind(&password_hash)
    .bind(&nickname)
    .execute(pool)
    .await?;

    tracing::info!("Admin user seeded: {} ({})", email, user_id);

    Ok(())
}
