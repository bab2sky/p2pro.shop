use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::{Executor, PgPool};

/// 비즈니스 timezone — 일별 cutoff (오늘 매출, 주간/월간 통계) 기준.
/// 글로벌 진출 D-3 (2026-05-07): 한국 본사 운영 시각 기준으로 고정.
/// TIMESTAMPTZ 컬럼은 여전히 UTC 저장, ::date / CURRENT_DATE / date_trunc 만 영향.
const BUSINESS_TIMEZONE: &str = "Asia/Seoul";

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let max_conn: u32 = std::env::var("DB_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10);

    // BUSINESS_TIMEZONE 환경변수 override 가능 (다른 본사 시각 도입 시).
    let business_tz =
        std::env::var("BUSINESS_TIMEZONE").unwrap_or_else(|_| BUSINESS_TIMEZONE.to_string());

    PgPoolOptions::new()
        .max_connections(max_conn)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        // 모든 connection 의 session timezone 을 비즈니스 시각으로 고정.
        // 효과: ::date, CURRENT_DATE, NOW(), date_trunc 모두 비즈니스 timezone 기준.
        // 영향 X: TIMESTAMPTZ row 는 UTC 그대로 (sqlx chrono::DateTime<Utc> 강제).
        .after_connect(move |conn, _meta| {
            let tz = business_tz.clone();
            Box::pin(async move {
                let stmt = format!("SET TIME ZONE '{}'", tz);
                conn.execute(stmt.as_str()).await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await
}
