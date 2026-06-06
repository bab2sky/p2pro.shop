// from_str → Option<Self> 패턴, FromStr trait 미구현 사유는 dispute.rs 와 동일.
#![allow(clippy::should_implement_trait)]

use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- Grade Level Enum ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GradeLevel {
    Bronze,
    Silver,
    Gold,
    Platinum,
    Diamond,
}

impl GradeLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Bronze => "bronze",
            Self::Silver => "silver",
            Self::Gold => "gold",
            Self::Platinum => "platinum",
            Self::Diamond => "diamond",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "bronze" => Some(Self::Bronze),
            "silver" => Some(Self::Silver),
            "gold" => Some(Self::Gold),
            "platinum" => Some(Self::Platinum),
            "diamond" => Some(Self::Diamond),
            _ => None,
        }
    }

    /// Determine grade level from a numeric score (0-100).
    /// Bronze: <30, Silver: 30-59, Gold: 60-79, Platinum: 80-94, Diamond: 95+
    pub fn from_score(score: f64) -> Self {
        if score >= 95.0 {
            Self::Diamond
        } else if score >= 80.0 {
            Self::Platinum
        } else if score >= 60.0 {
            Self::Gold
        } else if score >= 30.0 {
            Self::Silver
        } else {
            Self::Bronze
        }
    }

    /// Display name for UI badge
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Bronze => "Bronze",
            Self::Silver => "Silver",
            Self::Gold => "Gold",
            Self::Platinum => "Platinum",
            Self::Diamond => "Diamond",
        }
    }
}

/// Calculate the seller grade score.
///
/// Formula:
///   (total_sales_weight * 0.3) + (avg_rating_weight * 0.3)
///   + (response_rate * 0.2) + ((100 - dispute_rate) * 0.2)
///
/// - `total_sales_weight`: min(total_sales, 100) (capped at 100)
/// - `avg_rating_weight`: (avg_rating / 5.0) * 100.0
/// - `response_rate`: 0-100 percentage
/// - `dispute_rate`: 0-100 percentage
pub fn calculate_grade_score(
    total_sales: i32,
    avg_rating: f64,
    response_rate: f64,
    dispute_rate: f64,
) -> f64 {
    let sales_weight = (total_sales as f64).min(100.0);
    let rating_weight = (avg_rating / 5.0) * 100.0;
    let dispute_weight = (100.0 - dispute_rate).max(0.0);

    (sales_weight * 0.3) + (rating_weight * 0.3) + (response_rate * 0.2) + (dispute_weight * 0.2)
}

// --- Domain structs ---

#[derive(Debug, Serialize, FromRow)]
pub struct SellerGrade {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub grade: String,
    pub score: Option<BigDecimal>,
    pub total_sales: Option<i32>,
    pub avg_rating: Option<BigDecimal>,
    pub response_rate: Option<BigDecimal>,
    pub dispute_rate: Option<BigDecimal>,
    pub calculated_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SellerPublicProfile {
    pub id: Uuid,
    pub store_name: Option<String>,
    pub profile_image: Option<String>,
    pub grade: String,
    pub grade_badge: String,
    pub total_sales: i32,
    pub avg_rating: f64,
    pub response_rate: f64,
    pub member_since: Option<DateTime<Utc>>,
    pub products_count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grade_from_score() {
        assert_eq!(GradeLevel::from_score(0.0), GradeLevel::Bronze);
        assert_eq!(GradeLevel::from_score(29.9), GradeLevel::Bronze);
        assert_eq!(GradeLevel::from_score(30.0), GradeLevel::Silver);
        assert_eq!(GradeLevel::from_score(59.9), GradeLevel::Silver);
        assert_eq!(GradeLevel::from_score(60.0), GradeLevel::Gold);
        assert_eq!(GradeLevel::from_score(79.9), GradeLevel::Gold);
        assert_eq!(GradeLevel::from_score(80.0), GradeLevel::Platinum);
        assert_eq!(GradeLevel::from_score(94.9), GradeLevel::Platinum);
        assert_eq!(GradeLevel::from_score(95.0), GradeLevel::Diamond);
        assert_eq!(GradeLevel::from_score(100.0), GradeLevel::Diamond);
    }

    #[test]
    fn test_calculate_grade_score() {
        // Perfect seller: 100+ sales, 5.0 rating, 100% response, 0% disputes
        let score = calculate_grade_score(150, 5.0, 100.0, 0.0);
        assert!((score - 100.0).abs() < 0.01);

        // New seller: 0 sales, 0 rating, 0% response, 0% disputes
        let score = calculate_grade_score(0, 0.0, 0.0, 0.0);
        // 0*0.3 + 0*0.3 + 0*0.2 + 100*0.2 = 20.0
        assert!((score - 20.0).abs() < 0.01);

        // Average seller: 50 sales, 4.0 rating, 80% response, 5% disputes
        let score = calculate_grade_score(50, 4.0, 80.0, 5.0);
        // 50*0.3 + 80*0.3 + 80*0.2 + 95*0.2 = 15 + 24 + 16 + 19 = 74.0
        assert!((score - 74.0).abs() < 0.01);
    }
}
