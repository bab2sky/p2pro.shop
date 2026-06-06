mod common;

use sqlx::PgPool;

#[sqlx::test(migrations = "./migrations")]
async fn test_orders_requires_auth(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    // Accessing orders without auth should return 401
    let resp = app
        .client
        .get(format!("{}/api/orders", app.addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401, "Orders should require authentication");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_orders_list_authenticated(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    app.signup("orderuser", "order@test.com", "StrongPass1!")
        .await;
    let token = app.login_token("order@test.com", "StrongPass1!").await;

    let resp = app
        .client
        .get(format!("{}/api/orders", app.addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[sqlx::test(migrations = "./migrations")]
async fn test_cart_requires_auth(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!("{}/api/cart", app.addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401, "Cart should require authentication");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_cart_list_authenticated(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    app.signup("cartuser", "cart@test.com", "StrongPass1!")
        .await;
    let token = app.login_token("cart@test.com", "StrongPass1!").await;

    let resp = app
        .client
        .get(format!("{}/api/cart", app.addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(body["data"].is_array(), "Cart should return array");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_cart_add_invalid_product(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    app.signup("cartadd", "cartadd@test.com", "StrongPass1!")
        .await;
    let token = app.login_token("cartadd@test.com", "StrongPass1!").await;

    let resp = app
        .client
        .post(format!("{}/api/cart", app.addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "product_id": "00000000-0000-0000-0000-000000000000",
            "quantity": 1,
        }))
        .send()
        .await
        .unwrap();

    // Should fail — product doesn't exist
    assert!(
        resp.status() == 400 || resp.status() == 404 || resp.status() == 422,
        "Adding non-existent product should fail, got {}",
        resp.status()
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn test_orders_list_returns_empty_for_new_user(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;
    app.signup("neworder", "neworder@test.com", "StrongPass1!")
        .await;
    let token = app.login_token("neworder@test.com", "StrongPass1!").await;

    let resp = app
        .client
        .get(format!("{}/api/orders", app.addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let orders = body["data"].as_array().unwrap();
    assert!(orders.is_empty(), "New user should have no orders");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_notifications_requires_auth(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!("{}/api/notifications", app.addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401, "Notifications should require auth");
}
