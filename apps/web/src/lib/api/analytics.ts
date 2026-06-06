import api from './client';

export interface SalesSummary {
  total_sales: string;
  total_orders: number;
  avg_order_value: string;
  total_items_sold: number;
}

export interface DailySalesData {
  date: string;
  sales: string;
  orders: number;
}

export interface TopProduct {
  product_id: string;
  title: string;
  sold_quantity: number;
  revenue: string;
}

export interface TimeDeal {
  id: string;
  product_id: string;
  product_title: string;
  deal_price: string;
  original_price: string;
  discount_percent: number;
  max_quantity: number | null;
  sold_quantity: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  image?: string | null;
  title?: string;
}

export interface RegionalSurcharge {
  id: string;
  region_name: string;
  zipcode_prefixes: string[];
  surcharge: string;
  is_active: boolean;
}

export interface SurchargeCheckResult {
  has_surcharge: boolean;
  surcharge: number;
  region: string | null;
}

// Analytics
export const getSalesSummary = (params?: { start_date?: string; end_date?: string }) =>
  api.get<{ data: SalesSummary }>('/seller/analytics/sales', { params }).then((r) => r.data);

export const getSalesChartData = (params?: { start_date?: string; end_date?: string }) =>
  api.get<{ data: DailySalesData[] }>('/seller/analytics/sales/chart', { params }).then((r) => r.data);

export const getTopProducts = (params?: { start_date?: string; end_date?: string }) =>
  api.get<{ data: TopProduct[] }>('/seller/analytics/top-products', { params }).then((r) => r.data);

// Time Deals
export const createTimeDeal = (data: {
  product_id: string;
  deal_price: string;
  original_price: string;
  max_quantity?: number;
  starts_at: string;
  ends_at: string;
}) => api.post<{ data: { id: string } }>('/seller/time-deals', data).then((r) => r.data);

export const getSellerTimeDeals = () =>
  api.get<{ data: TimeDeal[] }>('/seller/time-deals').then((r) => r.data);

export const deleteTimeDeal = (id: string) =>
  api.delete(`/seller/time-deals/${id}`).then((r) => r.data);

export const getActiveTimeDeals = () =>
  api.get<{ data: TimeDeal[] }>('/time-deals/active').then((r) => r.data);

// Regional Surcharges
export const checkSurcharge = (zipcode: string) =>
  api.get<{ data: SurchargeCheckResult }>('/surcharges/check', { params: { zipcode } }).then((r) => r.data);

export const listSurcharges = () =>
  api.get<{ data: RegionalSurcharge[] }>('/surcharges').then((r) => r.data);
