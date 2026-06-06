use bigdecimal::BigDecimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Pagination {
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
    pub total_pages: i64,
}

impl Pagination {
    pub fn new(page: i64, per_page: i64, total: i64) -> Self {
        let total_pages = if total == 0 {
            0
        } else {
            (total + per_page - 1) / per_page
        };
        Self {
            page,
            per_page,
            total,
            total_pages,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl PaginationParams {
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(20).clamp(1, 100)
    }

    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.per_page()
    }
}

#[derive(Debug, Deserialize)]
pub struct ProductSearchParams {
    pub q: Option<String>,
    pub category_id: Option<Uuid>,
    pub min_price: Option<BigDecimal>,
    pub max_price: Option<BigDecimal>,
    pub sort: Option<String>,
    pub seller_grade: Option<String>,
    pub free_shipping: Option<bool>,
    pub condition: Option<String>,
    pub in_stock: Option<bool>,
    pub min_rating: Option<f64>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl ProductSearchParams {
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(20).clamp(1, 100)
    }

    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.per_page()
    }

    pub fn sort_column(&self) -> &str {
        match self.sort.as_deref() {
            Some("price_asc") | Some("price_desc") | Some("popular") | Some("reviews")
            | Some("rating") => self.sort.as_deref().unwrap(),
            _ => "latest",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct AutocompleteParams {
    pub q: String,
}
