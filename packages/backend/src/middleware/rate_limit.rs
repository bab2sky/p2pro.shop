use axum::{
    extract::{ConnectInfo, Request},
    middleware::Next,
    response::Response,
};
use governor::{
    clock::DefaultClock,
    state::keyed::DashMapStateStore,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppError;

pub type GlobalLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>;
pub type IpKeyedLimiter = Arc<RateLimiter<IpAddr, DashMapStateStore<IpAddr>, DefaultClock>>;
pub type UserKeyedLimiter = Arc<RateLimiter<String, DashMapStateStore<String>, DefaultClock>>;

/// Create a global rate limiter: `rate` requests per minute
pub fn create_limiter(rate_per_minute: u32) -> GlobalLimiter {
    let quota = Quota::per_minute(NonZeroU32::new(rate_per_minute).unwrap());
    Arc::new(RateLimiter::direct(quota))
}

/// Create an IP-keyed rate limiter: `rate` requests per minute per IP
pub fn create_ip_limiter(rate_per_minute: u32) -> IpKeyedLimiter {
    let quota = Quota::per_minute(NonZeroU32::new(rate_per_minute).unwrap());
    Arc::new(RateLimiter::dashmap(quota))
}

/// Create a user-keyed rate limiter: `rate` requests per minute per user ID
pub fn create_user_limiter(rate_per_minute: u32) -> UserKeyedLimiter {
    let quota = Quota::per_minute(NonZeroU32::new(rate_per_minute).unwrap());
    Arc::new(RateLimiter::dashmap(quota))
}

/// Named limiters for different endpoint groups
/// Route-specific limiters are IP-keyed to prevent one user from exhausting others' quota
/// The default limiter remains global for DDoS protection at the outermost layer
/// User-keyed limiters provide per-user rate limiting for authenticated sensitive endpoints
#[derive(Clone)]
pub struct RateLimiters {
    pub default: GlobalLimiter,          // 100/min global (DDoS protection)
    pub orders: IpKeyedLimiter,          // 10/min per IP
    pub txid: IpKeyedLimiter,            // 5/min per IP
    pub product_write: IpKeyedLimiter,   // 20/min per IP
    pub image_upload: IpKeyedLimiter,    // 30/min per IP
    pub search: IpKeyedLimiter,          // 60/min per IP
    pub auth_login: IpKeyedLimiter,      // 5/min per IP
    pub forgot_password: IpKeyedLimiter, // 3/min per IP
    pub chatbot: IpKeyedLimiter,         // 10/min per IP
    /// /auth/check-email|phone|referrer 전용. 가입자 enumeration 차단:
    /// 이전엔 auth_login 5/min 공유라 100K 이메일을 14일이면 훑을 수 있었다.
    /// 1/min은 정상 사용자도 거의 항상 429를 받는 문제가 있어 5/min으로 완화.
    /// 5/min/IP = 1년 약 2.6M 시도, enumeration 비용은 여전히 비실용적이고
    /// 정상 사용자가 폼 한 번 완주에 필요한 3회 호출 + 재시도 여유를 충분히 흡수.
    pub auth_enumeration: IpKeyedLimiter, // 5/min per IP
}

impl Default for RateLimiters {
    fn default() -> Self {
        Self::new()
    }
}

impl RateLimiters {
    pub fn new() -> Self {
        Self {
            default: create_limiter(100),  // global for outermost DDoS layer
            orders: create_ip_limiter(10), // per-IP for route-specific
            txid: create_ip_limiter(5),
            product_write: create_ip_limiter(20),
            image_upload: create_ip_limiter(30),
            search: create_ip_limiter(60),
            auth_login: create_ip_limiter(5),
            forgot_password: create_ip_limiter(3),
            chatbot: create_ip_limiter(10),
            auth_enumeration: create_ip_limiter(5),
        }
    }
}

/// Global rate limiting middleware (default DDoS protection tier)
pub async fn rate_limit_middleware(req: Request, next: Next) -> Result<Response, AppError> {
    if let Some(limiter) = req.extensions().get::<GlobalLimiter>() {
        if limiter.check().is_err() {
            return Err(AppError::RateLimited { retry_after: 60 });
        }
    }

    Ok(next.run(req).await)
}

/// IP-based rate limiting middleware (per-IP for route-specific limiters)
pub async fn ip_rate_limit_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    if let Some(limiter) = req.extensions().get::<IpKeyedLimiter>() {
        let ip = addr.ip();
        if limiter.check_key(&ip).is_err() {
            return Err(AppError::RateLimited { retry_after: 60 });
        }
    }

    Ok(next.run(req).await)
}

/// FR-20: User-keyed rate limiters grouped for inclusion in AppState
#[derive(Clone)]
pub struct UserRateLimiters {
    pub orders: UserKeyedLimiter,        // 5/min per user
    pub txid: UserKeyedLimiter,          // 3/min per user
    pub product_write: UserKeyedLimiter, // 10/min per user
}

impl Default for UserRateLimiters {
    fn default() -> Self {
        Self::new()
    }
}

impl UserRateLimiters {
    pub fn new() -> Self {
        Self {
            orders: create_user_limiter(5),
            txid: create_user_limiter(3),
            product_write: create_user_limiter(10),
        }
    }
}

/// FR-20: Check user-keyed rate limit for an authenticated user.
/// Call this from route handlers that have access to the authenticated user's ID.
/// Returns `Err(AppError::RateLimited)` if the user has exceeded their per-user quota.
pub fn check_user_rate_limit(limiter: &UserKeyedLimiter, user_id: Uuid) -> Result<(), AppError> {
    if limiter.check_key(&user_id.to_string()).is_err() {
        return Err(AppError::RateLimited { retry_after: 60 });
    }
    Ok(())
}
