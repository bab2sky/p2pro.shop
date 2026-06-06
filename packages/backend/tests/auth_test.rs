mod common;

use sqlx::PgPool;

#[sqlx::test(migrations = "./migrations")]
async fn test_signup_success(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    let resp = app.signup("newuser", "new@test.com", "StrongPass1!").await;
    // AuthResponse = { data: { access_token, refresh_token, expires_in, user: UserProfile } }
    // UserProfile.id 가 채워져 있으면 signup 성공.
    assert!(
        resp["data"]["user"]["id"].as_str().is_some(),
        "Signup should return user.id, got: {:?}",
        resp
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn test_signup_duplicate_email(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    app.signup("user1", "dup@test.com", "StrongPass1!").await;

    // 두 번째 signup 도 verify 키를 채운 뒤 동일 email 로 시도 → 409 기대.
    app.pre_verify_email("dup@test.com").await;
    let resp = app
        .client
        .post(format!("{}/api/auth/signup", app.addr))
        .json(&serde_json::json!({
            "email": "dup@test.com",
            "password": "StrongPass1!",
            "real_name": "Test User",
            "terms_agreed": true,
            "privacy_agreed": true,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 409, "Duplicate email should return 409");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_login_success(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    app.signup("loginuser", "login@test.com", "StrongPass1!")
        .await;

    let token = app.login_token("login@test.com", "StrongPass1!").await;
    assert!(!token.is_empty(), "Login should return a token");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_login_wrong_password(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    app.signup("wrongpw", "wrongpw@test.com", "StrongPass1!")
        .await;

    let resp = app.login("wrongpw@test.com", "WrongPass1!").await;
    assert_eq!(resp.status(), 401, "Wrong password should return 401");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_health_endpoint(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!("{}/api/health", app.addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["status"], "ok");
    assert_eq!(body["db"], "connected");
}
