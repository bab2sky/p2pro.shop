// 공유 테스트 헬퍼: 각 통합 테스트 크레이트가 자신이 쓰는 메서드만 가져가므로
// 다른 크레이트에서 사용하는 필드/메서드가 "이 크레이트에서는 미사용" 으로 보임.
// 의도된 패턴이라 dead_code 허용.
#![allow(dead_code)]

use sqlx::PgPool;
use std::net::SocketAddr;

pub struct TestApp {
    pub addr: String,
    pub db: PgPool,
    pub client: reqwest::Client,
    pub redis: redis::Client,
}

impl TestApp {
    /// Spawn an app server on a random port using the given test DB pool
    pub async fn spawn(pool: PgPool) -> Self {
        use std::sync::Arc;

        // Test config
        // JWT_SECRET 은 32자 이상 강제. 기존 값은 31자라 config 검증에서 실패.
        std::env::set_var("JWT_SECRET", "test-jwt-secret-for-integration-1");
        std::env::set_var("JWT_REFRESH_SECRET", "test-refresh-secret-for-integration");
        std::env::set_var("ALLOWED_ORIGINS", "*");

        let config =
            p2pro_backend::config::AppConfig::from_env().expect("Failed to load test config");

        let redis = redis::Client::open(
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        )
        .expect("Failed to create Redis client");

        let redis_for_test = redis.clone();
        let cache = p2pro_backend::cache::CacheLayer::new(redis.clone());
        let ws_hub = p2pro_backend::ws::WsHub::new();
        let http_client = reqwest::Client::new();
        let user_rate_limiters = p2pro_backend::middleware::rate_limit::UserRateLimiters::new();

        let state = p2pro_backend::AppState {
            db: pool.clone(),
            redis,
            cache,
            config: Arc::new(config),
            ws_hub,
            http_client,
            user_rate_limiters,
        };

        let rate_limiters = p2pro_backend::middleware::rate_limit::RateLimiters::new();

        let app = axum::Router::new()
            .nest(
                "/api",
                p2pro_backend::api::api_router(state.clone(), rate_limiters),
            )
            .with_state(state);

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind");
        let addr = listener.local_addr().expect("Failed to get local addr");

        tokio::spawn(async move {
            axum::serve(
                listener,
                app.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await
            .unwrap();
        });

        let client = reqwest::Client::new();

        TestApp {
            addr: format!("http://{}", addr),
            db: pool,
            client,
            redis: redis_for_test,
        }
    }

    /// signup endpoint 가 redis 의 email_verified:{email} 키 존재를 요구하므로
    /// 테스트가 임의로 verify 상태를 만들기 위한 helper. 운영 코드는 변경하지 않고
    /// 테스트만 verify 단계를 짧게 우회.
    pub async fn pre_verify_email(&self, email: &str) {
        let mut conn = self
            .redis
            .get_multiplexed_async_connection()
            .await
            .expect("Failed to connect to redis");
        let key = format!("email_verified:{}", email);
        let _: () = redis::cmd("SET")
            .arg(&key)
            .arg("1")
            .query_async(&mut conn)
            .await
            .expect("Failed to set verified key");
    }

    pub async fn signup(&self, _username: &str, email: &str, password: &str) -> serde_json::Value {
        // 운영 흐름: 이메일 인증 → signup. 테스트에서는 verify 키를 미리 채워서
        // signup endpoint 의 가드를 통과시킨다. 그 외 SignupRequest 필수
        // 필드(email, password, terms_agreed, privacy_agreed) 모두 포함.
        self.pre_verify_email(email).await;
        self.client
            .post(format!("{}/api/auth/signup", self.addr))
            .json(&serde_json::json!({
                "email": email,
                "password": password,
                "real_name": "Test User",
                "terms_agreed": true,
                "privacy_agreed": true,
            }))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap()
    }

    pub async fn login(&self, email: &str, password: &str) -> reqwest::Response {
        self.client
            .post(format!("{}/api/auth/login", self.addr))
            .json(&serde_json::json!({
                "email": email,
                "password": password,
            }))
            .send()
            .await
            .unwrap()
    }

    pub async fn login_token(&self, email: &str, password: &str) -> String {
        let resp: serde_json::Value = self.login(email, password).await.json().await.unwrap();
        resp["data"]["access_token"]
            .as_str()
            .unwrap_or_default()
            .to_string()
    }
}
