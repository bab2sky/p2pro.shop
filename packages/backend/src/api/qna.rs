use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::domain::common::PaginationParams;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

/// Public: GET Q&A list (no auth required)
pub fn product_qna_public_router() -> Router<AppState> {
    Router::new().route("/products/{id}/qna", get(list_qna))
}

/// Protected: POST question, POST answer (auth required)
pub fn product_qna_protected_router() -> Router<AppState> {
    Router::new()
        .route("/products/{id}/qna", post(create_question))
        .route("/qna/{id}/answer", post(create_answer))
}

#[derive(Debug, Serialize, FromRow)]
struct QnaItem {
    id: Uuid,
    #[serde(skip)]
    user_id: Uuid,
    user_nickname: Option<String>,
    question: String,
    answer: Option<String>,
    answered_at: Option<DateTime<Utc>>,
    is_secret: bool,
    created_at: Option<DateTime<Utc>>,
}

async fn list_qna(
    State(state): State<AppState>,
    Path(product_id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
    auth: Option<Extension<AuthUser>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM product_qna WHERE product_id = $1")
            .bind(product_id)
            .fetch_one(&state.db)
            .await?;

    let items = sqlx::query_as::<_, QnaItem>(
        r#"SELECT pq.id, pq.user_id, COALESCE(u.nickname, u.username) as user_nickname,
                  pq.question, pq.answer, pq.answered_at, pq.is_secret, pq.created_at
           FROM product_qna pq
           JOIN users u ON u.id = pq.user_id
           WHERE pq.product_id = $1
           ORDER BY pq.created_at DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(product_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    // Filter secret questions: only show to owner or product seller
    let user_id = auth.as_ref().map(|a| a.id);
    let seller_user_id = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT sp.user_id FROM products p
           JOIN seller_profiles sp ON sp.id = p.seller_id
           WHERE p.id = $1"#,
    )
    .bind(product_id)
    .fetch_optional(&state.db)
    .await?;

    let filtered: Vec<_> = items
        .into_iter()
        .map(|item| {
            if item.is_secret {
                // Check if user can see this secret question
                let can_see =
                    user_id.is_some_and(|uid| Some(uid) == seller_user_id || uid == item.user_id);
                if !can_see {
                    return serde_json::json!({
                        "id": item.id,
                        "user_nickname": "***",
                        "question": "비밀 질문입니다.",
                        "answer": null,
                        "answered_at": item.answered_at,
                        "is_secret": true,
                        "created_at": item.created_at,
                    });
                }
            }
            serde_json::json!(item)
        })
        .collect();

    Ok(Json(serde_json::json!({
        "data": filtered,
        "pagination": crate::domain::common::Pagination::new(page, per_page, total),
    })))
}

#[derive(serde::Deserialize)]
struct CreateQuestionRequest {
    question: String,
    is_secret: Option<bool>,
}

async fn create_question(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(product_id): Path<Uuid>,
    Json(req): Json<CreateQuestionRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.question.is_empty() {
        return Err(AppError::Validation {
            message: "Question cannot be empty".into(),
            field: Some("question".into()),
        });
    }

    // Verify product exists
    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)")
            .bind(product_id)
            .fetch_one(&state.db)
            .await?;

    if !exists {
        return Err(AppError::NotFound("Product not found".into()));
    }

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO product_qna (id, product_id, user_id, question, is_secret)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(id)
    .bind(product_id)
    .bind(auth.id)
    .bind(&req.question)
    .bind(req.is_secret.unwrap_or(false))
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "id": id } })))
}

#[derive(serde::Deserialize)]
struct CreateAnswerRequest {
    answer: String,
}

async fn create_answer(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(qna_id): Path<Uuid>,
    Json(req): Json<CreateAnswerRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.answer.is_empty() {
        return Err(AppError::Validation {
            message: "Answer cannot be empty".into(),
            field: Some("answer".into()),
        });
    }

    // Verify seller owns the product for this QnA
    let qna_product =
        sqlx::query_scalar::<_, Uuid>("SELECT product_id FROM product_qna WHERE id = $1")
            .bind(qna_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("QnA not found".into()))?;

    let is_seller = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN seller_profiles sp ON sp.id = p.seller_id
            WHERE p.id = $1 AND sp.user_id = $2
        )"#,
    )
    .bind(qna_product)
    .bind(auth.id)
    .fetch_one(&state.db)
    .await?;

    if !is_seller {
        return Err(AppError::Forbidden(
            "Only the product seller can answer".into(),
        ));
    }

    sqlx::query(
        "UPDATE product_qna SET answer = $1, answered_at = NOW(), updated_at = NOW() WHERE id = $2",
    )
    .bind(&req.answer)
    .bind(qna_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "answered": true } })))
}
