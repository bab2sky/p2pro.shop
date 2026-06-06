mod common;

use sqlx::PgPool;

#[sqlx::test(migrations = "./migrations")]
async fn test_product_list_public(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!("{}/api/products", app.addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(body["data"].is_array(), "Should return product array");
}

#[sqlx::test(migrations = "./migrations")]
async fn test_product_search(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!(
            "{}/api/products?q=nonexistent_test_query",
            app.addr
        ))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let products = body["data"].as_array().unwrap();
    assert!(
        products.is_empty(),
        "Search for nonexistent should return empty"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn test_categories_list(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!("{}/api/categories", app.addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[sqlx::test(migrations = "./migrations")]
async fn test_product_list_pagination(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!("{}/api/products?page=1&limit=5", app.addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(body["data"].is_array());
}

#[sqlx::test(migrations = "./migrations")]
async fn test_product_detail_not_found(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .get(format!(
            "{}/api/products/00000000-0000-0000-0000-000000000000",
            app.addr
        ))
        .send()
        .await
        .unwrap();

    assert!(
        resp.status() == 404 || resp.status() == 400,
        "Non-existent product should return 404 or 400"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn test_product_create_requires_auth(pool: PgPool) {
    let app = common::TestApp::spawn(pool).await;

    let resp = app
        .client
        .post(format!("{}/api/seller/products", app.addr))
        .json(&serde_json::json!({
            "name": "Test Product",
            "description": "A test product",
            "price": "100.00",
            "category_id": "00000000-0000-0000-0000-000000000000",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401, "Product creation should require auth");
}
