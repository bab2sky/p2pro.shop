import api from './client';

// ─── Seller Types (aligned with backend domain/profit.rs) ───

export interface CostBreakdown {
  commission: string;
  shipping: string;
  refunds: string;
  total_costs: string;
}

export interface PeriodComparison {
  previous_net_profit: string;
  previous_gross_sales: string;
  profit_change_pct: string;
  sales_change_pct: string;
}

export interface ProfitSummary {
  gross_sales: string;
  total_orders: number;
  margin_income: string;
  total_commission: string;
  total_shipping: string;
  net_profit: string;
  profit_margin: string;
  cost_breakdown: CostBreakdown;
  comparison: PeriodComparison;
}

export interface ProfitChartPoint {
  date: string;
  gross_sales: string;
  net_profit: string;
  orders: number;
}

export interface RevenueSection {
  gross_sales: string;
  refunds: string;
  net_revenue: string;
}

export interface CostOfGoodsSection {
  base_cost: string;
  shipping_cost: string;
  total_cogs: string;
}

export interface OperatingExpenses {
  commission: string;
  coupon_discounts: string;
  total_opex: string;
}

export interface NetIncomeSection {
  net_income: string;
  net_margin_pct: string;
}

export interface PnLStatement {
  period_start: string;
  period_end: string;
  revenue: RevenueSection;
  cost_of_goods: CostOfGoodsSection;
  gross_profit: string;
  operating_expenses: OperatingExpenses;
  net_income: NetIncomeSection;
}

export interface ProductProfit {
  product_id: string;
  title: string;
  base_price: string;
  avg_selling_price: string;
  units_sold: number;
  revenue: string;
  cost: string;
  profit: string;
  margin_pct: string;
}

export interface CommissionDetail {
  order_id: string;
  order_number: string;
  order_total: string;
  commission_rate: string;
  commission_amount: string;
  created_at: string;
}

export interface RefundLossItem {
  refund_id: string;
  order_id: string;
  amount: string;
  reason: string | null;
  created_at: string;
}

export interface RefundSummary {
  total_refunds: number;
  total_amount: string;
  items: RefundLossItem[];
}

export interface CashflowPoint {
  date: string;
  inflow: string;
  outflow: string;
  balance: string;
}

export interface CashflowSummary {
  current_balance: string;
  total_earned: string;
  total_withdrawn: string;
  total_fees: string;
  pending_settlements: string;
  chart: CashflowPoint[];
}

// ─── Admin Types ───

export interface PlatformComparison {
  previous_gmv: string;
  previous_commission: string;
  gmv_change_pct: string;
  commission_change_pct: string;
}

export interface PlatformSummary {
  gmv: string;
  total_orders: number;
  total_commission: string;
  total_withdrawal_fees: string;
  platform_revenue: string;
  total_refunds: string;
  net_platform_profit: string;
  comparison: PlatformComparison;
}

export interface PlatformChartPoint {
  date: string;
  gmv: string;
  commission: string;
  orders: number;
}

export interface SellerContribution {
  seller_id: string;
  business_name: string | null;
  gmv: string;
  orders: number;
  commission: string;
  refunds: string;
  net_contribution: string;
}

export interface CategoryProfit {
  category_id: string;
  category_name: string;
  gmv: string;
  orders: number;
  commission: string;
  units_sold: number;
}

export interface MonthlyPlatformPnL {
  month: string;
  gmv: string;
  commission: string;
  withdrawal_fees: string;
  refunds: string;
  net_profit: string;
}

// ─── Params ───

export interface ProfitParams {
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

// ─── Seller APIs ───

export const getSellerProfitSummary = (params?: ProfitParams) =>
  api.get<{ data: ProfitSummary }>('/seller/profit/summary', { params }).then((r) => r.data);

export const getSellerProfitChart = (params?: ProfitParams) =>
  api.get<{ data: ProfitChartPoint[] }>('/seller/profit/chart', { params }).then((r) => r.data);

export const getSellerPnLStatement = (params?: ProfitParams) =>
  api.get<{ data: PnLStatement }>('/seller/profit/statement', { params }).then((r) => r.data);

export const getSellerProductProfits = (params?: ProfitParams) =>
  api.get<{ data: ProductProfit[]; pagination: { page: number; per_page: number; total: number; total_pages: number } }>('/seller/profit/products', { params }).then((r) => r.data);

export const getSellerCommissions = (params?: ProfitParams) =>
  api.get<{ data: CommissionDetail[]; pagination: { page: number; per_page: number; total: number; total_pages: number } }>('/seller/profit/commissions', { params }).then((r) => r.data);

export const getSellerRefundLosses = (params?: ProfitParams) =>
  api.get<{ data: RefundSummary }>('/seller/profit/refunds', { params }).then((r) => r.data);

export const getSellerCashflow = (params?: ProfitParams) =>
  api.get<{ data: CashflowSummary }>('/seller/profit/cashflow', { params }).then((r) => r.data);

// ─── Admin APIs ───

export const getPlatformSummary = (params?: ProfitParams) =>
  api.get<{ data: PlatformSummary }>('/admin/profit/platform-summary', { params }).then((r) => r.data);

export const getPlatformChart = (params?: ProfitParams) =>
  api.get<{ data: PlatformChartPoint[] }>('/admin/profit/platform-chart', { params }).then((r) => r.data);

export const getSellerContributions = (params?: ProfitParams) =>
  api.get<{ data: SellerContribution[]; pagination: { page: number; per_page: number; total: number; total_pages: number } }>('/admin/profit/sellers', { params }).then((r) => r.data);

export const getCategoryProfits = (params?: ProfitParams) =>
  api.get<{ data: CategoryProfit[] }>('/admin/profit/categories', { params }).then((r) => r.data);

export const getPlatformPnL = (params?: ProfitParams) =>
  api.get<{ data: MonthlyPlatformPnL[] }>('/admin/profit/platform-pnl', { params }).then((r) => r.data);

// ─── Export APIs (XLSX download) ───

export const downloadSellerProfitExport = (params?: ProfitParams) =>
  api.get<Blob>('/seller/profit/export', { params, responseType: 'blob' }).then((r) => r.data);

export const downloadPlatformProfitExport = (params?: ProfitParams) =>
  api.get<Blob>('/admin/profit/export', { params, responseType: 'blob' }).then((r) => r.data);
