use bigdecimal::BigDecimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- Autocomplete ---

#[derive(Debug, Serialize)]
pub struct AutocompleteResponse {
    pub products: Vec<AutocompleteProduct>,
    pub categories: Vec<AutocompleteCategory>,
    pub keywords: Vec<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AutocompleteProduct {
    pub id: Uuid,
    pub title: String,
    pub image: Option<String>,
    pub price: Option<BigDecimal>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AutocompleteCategory {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
}

// --- Popular Keywords ---

#[derive(Debug, Serialize)]
pub struct PopularKeyword {
    pub rank: i32,
    pub keyword: String,
    pub count: i64,
}

#[derive(Debug, Deserialize)]
pub struct PopularKeywordsParams {
    pub period: Option<String>, // daily, weekly
}

// --- Search Log ---

#[derive(Debug, Deserialize)]
pub struct SearchLogRequest {
    pub keyword: String,
}

// --- Review Vote ---

#[derive(Debug, Deserialize)]
pub struct ReviewVoteRequest {
    pub is_helpful: bool,
}

#[derive(Debug, Serialize)]
pub struct ReviewVoteResponse {
    pub helpful_count: i32,
    pub unhelpful_count: i32,
    pub user_voted: bool,
}

// --- Review Filter ---

#[derive(Debug, Deserialize)]
pub struct ReviewFilterParams {
    pub rating: Option<i16>,
    pub has_images: Option<bool>,
    pub sort: Option<String>, // latest, rating_high, rating_low, helpful
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl ReviewFilterParams {
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(10).clamp(1, 50)
    }

    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.per_page()
    }

    pub fn order_clause(&self) -> &str {
        match self.sort.as_deref() {
            Some("rating_high") => "r.rating DESC, r.created_at DESC",
            Some("rating_low") => "r.rating ASC, r.created_at DESC",
            Some("helpful") => "r.helpful_count DESC, r.created_at DESC",
            _ => "r.created_at DESC",
        }
    }
}

// --- Option Image ---

#[derive(Debug, Deserialize)]
pub struct OptionImageRequest {
    pub image_url: String,
}
