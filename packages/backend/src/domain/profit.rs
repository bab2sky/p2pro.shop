use bigdecimal::BigDecimal;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// --- Query Params ---

#[derive(Debug, Deserialize)]
pub struct ProfitPeriodParams {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub period: Option<String>, // daily, weekly, monthly
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// --- Pagination ---

#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
    pub total_pages: i64,
}

// --- Seller Profit ---

#[derive(Debug, Serialize)]
pub struct SellerProfitSummary {
    pub gross_sales: BigDecimal,
    pub total_orders: i64,
    pub margin_income: BigDecimal,
    pub total_commission: BigDecimal,
    pub total_shipping: BigDecimal,
    pub net_profit: BigDecimal,
    pub profit_margin: BigDecimal,
    pub cost_breakdown: CostBreakdown,
    pub comparison: PeriodComparison,
}

#[derive(Debug, Serialize)]
pub struct CostBreakdown {
    pub commission: BigDecimal,
    pub shipping: BigDecimal,
    pub refunds: BigDecimal,
    pub total_costs: BigDecimal,
}

#[derive(Debug, Serialize)]
pub struct PeriodComparison {
    pub previous_net_profit: BigDecimal,
    pub previous_gross_sales: BigDecimal,
    pub profit_change_pct: BigDecimal,
    pub sales_change_pct: BigDecimal,
}

// --- Chart ---

#[derive(Debug, Serialize)]
pub struct ProfitChartPoint {
    pub date: NaiveDate,
    pub gross_sales: BigDecimal,
    pub net_profit: BigDecimal,
    pub orders: i64,
}

// --- P&L Statement ---

#[derive(Debug, Serialize)]
pub struct PnLStatement {
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub revenue: RevenueSection,
    pub cost_of_goods: CostOfGoodsSection,
    pub gross_profit: BigDecimal,
    pub operating_expenses: OperatingExpenses,
    pub net_income: NetIncomeSection,
}

#[derive(Debug, Serialize)]
pub struct RevenueSection {
    pub gross_sales: BigDecimal,
    pub refunds: BigDecimal,
    pub net_revenue: BigDecimal,
}

#[derive(Debug, Serialize)]
pub struct CostOfGoodsSection {
    pub base_cost: BigDecimal,
    pub shipping_cost: BigDecimal,
    pub total_cogs: BigDecimal,
}

#[derive(Debug, Serialize)]
pub struct OperatingExpenses {
    pub commission: BigDecimal,
    pub coupon_discounts: BigDecimal,
    pub total_opex: BigDecimal,
}

#[derive(Debug, Serialize)]
pub struct NetIncomeSection {
    pub net_income: BigDecimal,
    pub net_margin_pct: BigDecimal,
}

// --- Product Profit ---

#[derive(Debug, Serialize)]
pub struct ProductProfit {
    pub product_id: Uuid,
    pub title: String,
    pub base_price: BigDecimal,
    pub avg_selling_price: BigDecimal,
    pub units_sold: i64,
    pub revenue: BigDecimal,
    pub cost: BigDecimal,
    pub profit: BigDecimal,
    pub margin_pct: BigDecimal,
}

// --- Commission Detail ---

#[derive(Debug, Serialize)]
pub struct CommissionDetail {
    pub order_id: Uuid,
    pub order_number: String,
    pub order_total: BigDecimal,
    pub commission_rate: BigDecimal,
    pub commission_amount: BigDecimal,
    pub created_at: DateTime<Utc>,
}

// --- Refunds ---

#[derive(Debug, Serialize)]
pub struct RefundLossItem {
    pub refund_id: Uuid,
    pub order_id: Uuid,
    pub amount: BigDecimal,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RefundSummary {
    pub total_refunds: i64,
    pub total_amount: BigDecimal,
    pub items: Vec<RefundLossItem>,
}

// --- Cashflow ---

#[derive(Debug, Serialize)]
pub struct CashflowSummary {
    pub current_balance: BigDecimal,
    pub total_earned: BigDecimal,
    pub total_withdrawn: BigDecimal,
    pub total_fees: BigDecimal,
    pub pending_settlements: BigDecimal,
    pub chart: Vec<CashflowPoint>,
}

#[derive(Debug, Serialize)]
pub struct CashflowPoint {
    pub date: NaiveDate,
    pub inflow: BigDecimal,
    pub outflow: BigDecimal,
    pub balance: BigDecimal,
}

// --- Platform (Admin) Profit ---

#[derive(Debug, Serialize)]
pub struct PlatformProfitSummary {
    pub gmv: BigDecimal,
    pub total_orders: i64,
    pub total_commission: BigDecimal,
    pub total_withdrawal_fees: BigDecimal,
    pub platform_revenue: BigDecimal,
    pub total_refunds: BigDecimal,
    pub net_platform_profit: BigDecimal,
    pub comparison: PlatformComparison,
}

#[derive(Debug, Serialize)]
pub struct PlatformComparison {
    pub previous_gmv: BigDecimal,
    pub previous_commission: BigDecimal,
    pub gmv_change_pct: BigDecimal,
    pub commission_change_pct: BigDecimal,
}

#[derive(Debug, Serialize)]
pub struct PlatformChartPoint {
    pub date: NaiveDate,
    pub gmv: BigDecimal,
    pub commission: BigDecimal,
    pub orders: i64,
}

#[derive(Debug, Serialize)]
pub struct SellerContribution {
    pub seller_id: Uuid,
    pub business_name: Option<String>,
    pub gmv: BigDecimal,
    pub orders: i64,
    pub commission: BigDecimal,
    pub refunds: BigDecimal,
    pub net_contribution: BigDecimal,
}

#[derive(Debug, Serialize)]
pub struct CategoryProfit {
    pub category_id: Uuid,
    pub category_name: String,
    pub gmv: BigDecimal,
    pub orders: i64,
    pub commission: BigDecimal,
    pub units_sold: i64,
}

#[derive(Debug, Serialize)]
pub struct MonthlyPlatformPnL {
    pub month: String,
    pub gmv: BigDecimal,
    pub commission: BigDecimal,
    pub withdrawal_fees: BigDecimal,
    pub refunds: BigDecimal,
    pub net_profit: BigDecimal,
}
