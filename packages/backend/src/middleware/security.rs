use axum::http::HeaderValue;
use axum::{extract::Request, middleware::Next, response::Response};

/// 모든 응답에 보안 헤더를 추가하는 미들웨어
pub async fn security_headers_middleware(req: Request, next: Next) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );

    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));

    headers.insert(
        "x-xss-protection",
        HeaderValue::from_static("1; mode=block"),
    );

    headers.insert(
        "strict-transport-security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );

    // FR-03: CSP hardening — removed unsafe-inline/unsafe-eval from script-src
    // style-src 'unsafe-inline' kept for Tailwind CSS v4 runtime
    headers.insert(
        "content-security-policy",
        HeaderValue::from_static(
            "default-src 'self'; \
             script-src 'self'; \
             style-src 'self' 'unsafe-inline'; \
             img-src 'self' data: https:; \
             font-src 'self' data:; \
             connect-src 'self' wss: ws:; \
             frame-ancestors 'none'",
        ),
    );

    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );

    response
}
