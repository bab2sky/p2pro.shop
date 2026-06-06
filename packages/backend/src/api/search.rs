use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};

use crate::domain::search::*;
use crate::{AppError, AppState};

/// Public search routes
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/search/popular", get(get_popular_keywords))
        .route("/search/log", post(log_search_keyword))
}

// --- Handlers ---

/// GET /api/search/popular
/// 인기 검색어 TOP 10 (FR-B07)
async fn get_popular_keywords(
    State(state): State<AppState>,
    Query(params): Query<PopularKeywordsParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let period = params.period.as_deref().unwrap_or("daily");
    let days = match period {
        "weekly" => 7,
        _ => 1,
    };

    let keywords = sqlx::query_as::<_, (String, i64)>(
        r#"SELECT keyword, SUM(search_count)::bigint as total
           FROM search_keywords
           WHERE date >= CURRENT_DATE - $1::int
           GROUP BY keyword
           ORDER BY total DESC
           LIMIT 10"#,
    )
    .bind(days)
    .fetch_all(&state.db)
    .await?;

    let result: Vec<PopularKeyword> = keywords
        .into_iter()
        .enumerate()
        .map(|(i, (keyword, count))| PopularKeyword {
            rank: (i + 1) as i32,
            keyword,
            count,
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": result })))
}

/// POST /api/search/log
/// 검색어 로깅 (FR-B07 데이터 수집)
async fn log_search_keyword(
    State(state): State<AppState>,
    Json(req): Json<SearchLogRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let keyword = req.keyword.trim();
    if keyword.is_empty() || keyword.len() > 200 {
        return Ok(Json(serde_json::json!({ "data": { "logged": false } })));
    }

    // Upsert: increment count for today
    sqlx::query(
        r#"INSERT INTO search_keywords (keyword, search_count, date)
           VALUES ($1, 1, CURRENT_DATE)
           ON CONFLICT (keyword, date)
           DO UPDATE SET search_count = search_keywords.search_count + 1"#,
    )
    .bind(keyword)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": { "logged": true } })))
}
