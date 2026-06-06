import api from './client';

export interface DashboardStats {
  total_orders: number;
  pending_payments: number;
  pending_txid_verify: number;
  pending_products: number;
  total_revenue: string;
  today_orders: number;
  today_revenue: string;
  active_sellers: number;
  total_users: number;
  shipped_orders: number;
  delivered_orders: number;
  confirmed_orders: number;
  cancelled_orders: number;
  new_users_7d: number;
  total_products: number;
  active_products: number;
  open_disputes: number;
  pending_refunds: number;
  pending_withdrawals: number;
  week_revenue: string;
  month_revenue: string;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  total_amount: string;
  status: string;
  created_at: string;
}

export interface PendingActions {
  products: number;
  txid: number;
  sellers: number;
  refunds: number;
  disputes: number;
  withdrawals: number;
}

export interface OrderStatusBreakdown {
  status: string;
  count: number;
}

export interface RecentActivity {
  action: string;
  target_type: string;
  detail: string;
  created_at: string | null;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_orders: RecentOrder[];
  pending_actions: PendingActions;
  order_status_breakdown: OrderStatusBreakdown[];
  recent_activities: RecentActivity[];
}

export interface PendingProduct {
  id: string;
  title: string;
  seller_name: string;
  price: string | null;
  status: string;
  created_at: string;
}

export interface AdminProduct {
  id: string;
  title: string;
  seller_name: string;
  seller_email: string | null;
  category_name: string | null;
  base_price: string | null;
  margin_rate: string | null;
  final_price: string | null;
  shipping_fee: string | null;
  stock: number | null;
  sold_count: number | null;
  view_count: number | null;
  review_count: number | null;
  avg_rating: string | null;
  status: string;
  rejected_reason: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductStats {
  total_products: number;
  pending_products: number;
  active_products: number;
  rejected_products: number;
  suspended_products: number;
  today_new: number;
  out_of_stock: number;
  total_sold: number;
}

export interface PendingTxid {
  id: string;
  order_id: string;
  order_number: string;
  txid: string;
  buyer_name: string;
  total_amount: string;
  verification_status: string | null;
  failure_reason: string | null;
  submitted_at: string | null;
}

export interface SellerInfo {
  id: string;
  user_id: string;
  seller_type: string;
  contact_phone: string | null;
  seller_name: string;
  email: string | null;
  wallet_address: string | null;
  status: string;
  balance: string | null;
  total_sales: number | null;
  total_revenue: string | null;
  avg_rating: string | null;
  grade: number | null;
  grade_score: string | null;
  dispute_count: number | null;
  rejected_reason: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface SellerStats {
  total_sellers: number;
  pending_sellers: number;
  approved_sellers: number;
  suspended_sellers: number;
  rejected_sellers: number;
  today_new: number;
  total_revenue: string;
  total_balance: string;
}

export interface UserInfo {
  id: string;
  email: string;
  real_name: string;
  nickname: string | null;
  role: string;
  status: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface UserDetail {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  real_name: string;
  nickname: string | null;
  profile_image: string | null;
  role: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_udg_member: boolean;
  is_2fa_enabled: boolean;
  locale: string | null;
  status: string | null;
  withdrawn_at: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UserUpdateData {
  email?: string;
  phone?: string;
  role?: string;
  nickname?: string;
  status?: string;
  is_email_verified?: boolean;
  is_phone_verified?: boolean;
  is_udg_member?: boolean;
  reset_2fa?: boolean;
}

export interface UserSellerProfile {
  seller_id: string;
  seller_type: string;
  wallet_address: string;
  contact_phone: string | null;
  deposit_amount: string;
  balance: string;
  total_sales: number;
  total_revenue: string;
  avg_rating: string;
  response_rate: string;
  avg_ship_days: string;
  grade: number;
  grade_score: string;
  dispute_count: number;
  seller_status: string;
  approved_at: string | null;
  seller_created_at: string | null;
}

export interface UserSellerGrade {
  grade: string;
  score: string;
  total_sales: number;
  avg_rating: string;
  response_rate: string;
  dispute_rate: string;
  calculated_at: string | null;
}

export interface UserOrderStats {
  total_orders: number;
  total_spent: string;
  completed_orders: number;
  cancelled_orders: number;
}

export interface UserDetailResponse {
  user: UserDetail;
  seller_profile: UserSellerProfile | null;
  seller_grade: UserSellerGrade | null;
  order_stats: UserOrderStats;
}

export interface AdminLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export type { Pagination } from './types';
import type { Pagination } from './types';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export const adminApi = {
  getDashboard: () =>
    api.get<{ data: DashboardData }>('/admin/dashboard'),

  getProducts: (page = 1, perPage = 20, status?: string, q?: string, sort?: string) =>
    api.get<PaginatedResponse<AdminProduct>>('/admin/products', {
      params: { page, per_page: perPage, status, q, sort },
    }),

  getProductStats: () =>
    api.get<{ data: ProductStats }>('/admin/products/stats'),

  getPendingProducts: (page = 1, perPage = 20) =>
    api.get<PaginatedResponse<PendingProduct>>('/admin/products/pending', {
      params: { page, per_page: perPage },
    }),

  approveProduct: (id: string) =>
    api.put(`/admin/products/${id}/approve`),

  rejectProduct: (id: string, reason: string) =>
    api.put(`/admin/products/${id}/reject`, { reason }),

  suspendProduct: (id: string, reason: string) =>
    api.put(`/admin/products/${id}/suspend`, { reason }),

  restoreProduct: (id: string) =>
    api.put(`/admin/products/${id}/restore`),

  getPendingTxids: (page = 1, perPage = 20) =>
    api.get<PaginatedResponse<PendingTxid>>('/admin/txid/pending', {
      params: { page, per_page: perPage },
    }),

  verifyTxid: (id: string, action: 'approve' | 'reject', reason?: string) =>
    api.put(`/admin/txid/${id}/verify`, { action, reason }),

  getSellers: (page = 1, perPage = 20, status?: string, q?: string) =>
    api.get<PaginatedResponse<SellerInfo>>('/admin/sellers', {
      params: { page, per_page: perPage, status, q },
    }),

  getSellerStats: () =>
    api.get<{ data: SellerStats }>('/admin/sellers/stats'),

  updateSellerStatus: (id: string, status: 'approved' | 'suspended' | 'rejected', reason?: string) =>
    api.put(`/admin/sellers/${id}/status`, { status, reason }),

  updateSellerWallet: (id: string, wallet_address: string, reason?: string) =>
    api.put<{ data: { id: string; wallet_address: string } }>(
      `/admin/sellers/${id}/wallet`,
      { wallet_address, reason },
    ),

  getUserStats: () =>
    api.get<{ data: { total_users: number; buyers: number; sellers: number; admins: number; active_users: number; banned_users: number; suspended_users: number; new_users_7d: number } }>('/admin/users/stats'),

  getUsers: (page = 1, perPage = 20, q?: string, role?: string) =>
    api.get<PaginatedResponse<UserInfo>>('/admin/users', {
      params: { page, per_page: perPage, q, role },
    }),

  getUser: (id: string) =>
    api.get<{ data: UserDetailResponse }>(`/admin/users/${id}`),

  updateUser: (id: string, data: UserUpdateData) =>
    api.put(`/admin/users/${id}`, data),

  blockUser: (id: string, blocked: boolean) =>
    api.put(`/admin/users/${id}/block`, { blocked }),

  getCategories: () =>
    api.get('/admin/categories'),

  createCategory: (data: { name: string; parent_id?: string; sort_order?: number; slug?: string; icon?: string; commission_rate?: number; is_digital?: boolean }) =>
    api.post('/admin/categories', data),

  updateCategory: (id: string, data: { name: string; parent_id?: string | null; sort_order?: number; slug?: string; icon?: string; commission_rate?: number; is_digital?: boolean }) =>
    api.put(`/admin/categories/${id}`, data),

  deleteCategory: (id: string) =>
    api.delete(`/admin/categories/${id}`),

  reorderCategories: (items: { id: string; sort_order: number; parent_id?: string | null }[]) =>
    api.put('/admin/categories/reorder', { items }),

  moveCategory: (id: string, data: { parent_id?: string | null; sort_order?: number }) =>
    api.put(`/admin/categories/${id}/move`, data),

  toggleCategoryActive: (id: string) =>
    api.put(`/admin/categories/${id}/toggle-active`),

  getLogs: (page = 1, perPage = 20) =>
    api.get<PaginatedResponse<AdminLogEntry>>('/admin/logs', {
      params: { page, per_page: perPage },
    }),

  getSettings: () =>
    api.get<{ data: Record<string, string> }>('/admin/settings'),

  updateSettings: (settings: Record<string, string>) =>
    api.put('/admin/settings', settings),

  getEmailLogs: (page = 1, perPage = 20) =>
    api.get('/admin/email-logs', {
      params: { page, per_page: perPage },
    }),

  // Reviews
  getAdminReviews: (page = 1, perPage = 20, status?: string, q?: string, sort?: string) =>
    api.get<PaginatedResponse<AdminReviewItem>>('/admin/reviews', {
      params: { page, per_page: perPage, status, q, sort },
    }),

  getReviewStats: () =>
    api.get<{ data: ReviewStats }>('/admin/reviews/stats'),

  getLowRatedProducts: () =>
    api.get<{ data: LowRatedProduct[] }>('/admin/reviews/low-rated'),

  hideReview: (id: string) =>
    api.put(`/admin/reviews/${id}/hide`),

  deleteReview: (id: string) =>
    api.delete(`/admin/reviews/${id}`),

  // Shipping Management
  getShipments: (page = 1, perPage = 20, status?: string, q?: string, sort?: string) =>
    api.get<PaginatedResponse<AdminShipment>>('/admin/shipping', {
      params: { page, per_page: perPage, status, q, sort },
    }),

  getShippingStats: () =>
    api.get<{ data: ShippingStats }>('/admin/shipping/stats'),

  getOverdueShipments: (page = 1, perPage = 20) =>
    api.get<PaginatedResponse<AdminShipment>>('/admin/shipping/overdue', {
      params: { page, per_page: perPage },
    }),

  getSellerShippingPerformance: (page = 1, perPage = 20, sort?: string) =>
    api.get<{ data: SellerShippingPerf[] }>('/admin/shipping/sellers', {
      params: { page, per_page: perPage, sort },
    }),

  // AI Chatbot
  testChatbot: () =>
    api.post<{ data: { success: boolean; reply: string; error: string } }>('/admin/chatbot/test'),

  // UDG Integration
  getUdgEvents: (page = 1, perPage = 20, status?: string) =>
    api.get<PaginatedResponse<UdgEvent>>('/admin/udg/events', {
      params: { page, per_page: perPage, status },
    }),

  getUdgStats: () =>
    api.get<{ data: UdgStats }>('/admin/udg/stats'),

  getAuditLogs: (params: {
    page?: number;
    per_page?: number;
    action?: string;
    admin_id?: string;
    date_from?: string;
    date_to?: string;
  } = {}) =>
    api.get<PaginatedResponse<AuditLogEntry>>('/admin/audit-logs', { params }),

  getHealthCheck: () =>
    api.get<{ data: HealthStatus }>('/health'),
};

export interface AdminReviewItem {
  id: string;
  product_id: string;
  product_title: string | null;
  product_status: string | null;
  seller_name: string | null;
  seller_id: string | null;
  buyer_nickname: string | null;
  rating: number;
  content: string | null;
  seller_reply: string | null;
  is_reported: boolean | null;
  report_reason: string | null;
  is_hidden: boolean | null;
  created_at: string | null;
}

export interface ReviewStats {
  total_reviews: number;
  avg_rating: string;
  reported_count: number;
  hidden_count: number;
  low_rating_count: number;
  no_reply_count: number;
  week_new_count: number;
}

export interface LowRatedProduct {
  product_id: string;
  product_title: string;
  seller_name: string | null;
  product_status: string | null;
  review_count: number;
  avg_rating: string;
  low_rating_count: number;
}

export interface AdminShipment {
  order_id: string;
  order_number: string;
  buyer_name: string | null;
  seller_name: string | null;
  seller_id: string | null;
  order_status: string;
  carrier_name: string | null;
  tracking_number: string | null;
  shipping_status: string | null;
  total_amount: string | null;
  ordered_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  auto_confirm_at: string | null;
}

export interface ShippingStats {
  awaiting_shipment: number;
  in_transit: number;
  delivered: number;
  confirmed: number;
  overdue: number;
  exceptions: number;
  avg_ship_days_30d: number;
  week_orders: number;
}

export interface SellerShippingPerf {
  seller_id: string;
  seller_name: string | null;
  total_orders: number | null;
  shipped_count: number | null;
  delivered_count: number | null;
  avg_ship_days: number | null;
  on_time_rate: number | null;
  exception_count: number | null;
  pending_ship_count: number | null;
}

export interface UdgEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  response_status: number | null;
  order_id: string | null;
  created_at: string | null;
}

export interface UdgStats {
  total: number;
  sent: number;
  failed: number;
  dlq: number;
  success_rate: string;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string | null;
}

export interface HealthStatus {
  status: string;
  db: string;
  redis: string;
  udg_webhook: string;
  latency_ms: number;
  version: string;
}
