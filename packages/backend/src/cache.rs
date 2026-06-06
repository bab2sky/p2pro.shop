use redis::aio::MultiplexedConnection;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct CacheLayer {
    client: redis::Client,
    /// Persistent multiplexed connection (reused across all operations)
    conn: Arc<RwLock<Option<MultiplexedConnection>>>,
}

impl CacheLayer {
    pub fn new(client: redis::Client) -> Self {
        Self {
            client,
            conn: Arc::new(RwLock::new(None)),
        }
    }

    /// Get or create the persistent multiplexed connection
    async fn get_conn(&self) -> Result<MultiplexedConnection, redis::RedisError> {
        // Fast path: read lock to check if connection exists
        {
            let guard = self.conn.read().await;
            if let Some(ref conn) = *guard {
                return Ok(conn.clone());
            }
        }
        // Slow path: write lock to create connection
        let mut guard = self.conn.write().await;
        // Double-check after acquiring write lock
        if let Some(ref conn) = *guard {
            return Ok(conn.clone());
        }
        let conn = self.client.get_multiplexed_async_connection().await?;
        *guard = Some(conn.clone());
        Ok(conn)
    }

    /// Get from cache or execute fallback and store result
    pub async fn get_or_set<T, F, Fut>(
        &self,
        key: &str,
        ttl_secs: u64,
        fallback: F,
    ) -> Result<T, anyhow::Error>
    where
        T: Serialize + for<'de> Deserialize<'de>,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, anyhow::Error>>,
    {
        if let Ok(mut conn) = self.get_conn().await {
            if let Ok(cached) = conn.get::<_, String>(key).await {
                if let Ok(val) = serde_json::from_str::<T>(&cached) {
                    return Ok(val);
                }
            }
        }

        let val = fallback().await?;

        // Best-effort cache write
        if let Ok(mut conn) = self.get_conn().await {
            if let Ok(json) = serde_json::to_string(&val) {
                let _: Result<(), _> = conn.set_ex(key, &json, ttl_secs).await;
            }
        }

        Ok(val)
    }

    /// Invalidate a specific key
    pub async fn invalidate(&self, key: &str) {
        if let Ok(mut conn) = self.get_conn().await {
            let _: Result<(), _> = conn.del(key).await;
        }
    }

    /// Invalidate keys matching a pattern (CRIT-07: uses SCAN instead of KEYS)
    pub async fn invalidate_pattern(&self, pattern: &str) {
        if let Ok(mut conn) = self.get_conn().await {
            let mut cursor: u64 = 0;
            loop {
                let result: Result<(u64, Vec<String>), _> = redis::cmd("SCAN")
                    .arg(cursor)
                    .arg("MATCH")
                    .arg(pattern)
                    .arg("COUNT")
                    .arg(100)
                    .query_async(&mut conn)
                    .await;

                match result {
                    Ok((next_cursor, keys)) => {
                        for key in keys {
                            let _: Result<(), _> = conn.del(&key).await;
                        }
                        if next_cursor == 0 {
                            break;
                        }
                        cursor = next_cursor;
                    }
                    Err(_) => break,
                }
            }
        }
    }
}
