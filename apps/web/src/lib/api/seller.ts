import api from './client';

export interface SellerApplyPayload {
  seller_type: 'individual' | 'business';
  wallet_address: string;
  contact_phone?: string;
  main_category_id?: string;
}

// Round 8b (Audit FE-BE H-4): SellerPublicProfile 은 sellerGrade.ts 가 정확한
// shape (백엔드 응답과 일치). 동일 이름 중복 제거 + re-export.
export type { SellerPublicProfile } from './sellerGrade';

export interface MySellerProfile {
  id: string;
  user_id: string;
  seller_type: string;
  wallet_address: string;
  contact_phone: string | null;
  main_category_id: string | null;
  deposit_amount: string | null;
  balance: string | null;
  total_sales: number | null;
  total_revenue: string | null;
  avg_rating: string | null;
  response_rate: string | null;
  avg_ship_days: string | null;
  grade: number | null;
  grade_score: string | null;
  dispute_count: number | null;
  status: string | null;
  rejected_reason: string | null;
  approved_at: string | null;
  created_at: string | null;
  business_name: string | null;
  business_number: string | null;
  representative_name: string | null;
  business_address: string | null;
  business_type: string | null;
  business_category: string | null;
  /** v1.3.10: 한 번 등록하면 true. UI 가 잠금 표시 + 변경 불가. */
  wallet_locked: boolean;
}

export const applySeller = (data: SellerApplyPayload) =>
  api.post('/seller/apply', data).then((r) => r.data);

export const getMySellerProfile = () =>
  api.get<{ data: MySellerProfile }>('/seller/profile').then((r) => r.data);

// Round 8b: dead code 였던 getSellerProfile 제거. sellerGrade.ts 의 동명 함수를 사용.
export { getSellerProfile } from './sellerGrade';

export interface SellerDashboardStats {
  total_products: number;
  active_products: number;
  pending_products: number;
  total_orders: number;
  pending_orders: number;
  shipping_orders: number;
  delivered_orders: number;
  confirmed_orders: number;
  unanswered_qna: number;
  new_reviews: number;
  today_sales: string;
  month_sales: string;
}

export interface SellerReview {
  id: string;
  product_id: string;
  product_title: string;
  rating: number;
  content: string | null;
  user_nickname: string | null;
  created_at: string;
  seller_reply: string | null;
  seller_replied_at: string | null;
}

export interface SellerQna {
  id: string;
  product_id: string;
  product_title: string;
  user_nickname: string | null;
  question: string;
  answer: string | null;
  answered_at: string | null;
  is_secret: boolean;
  created_at: string;
}

export interface DailySales {
  date: string;
  order_count: number;
  total_amount: string;
}

export const getDashboardStats = () =>
  api.get<{ data: SellerDashboardStats }>('/seller/dashboard-stats').then((r) => r.data.data);

export const getSellerReviews = (params?: { page?: number; per_page?: number }) =>
  api.get<{ data: SellerReview[]; pagination: import('./types').Pagination }>('/seller/reviews', { params }).then((r) => r.data);

export const getSellerQna = (params?: { page?: number; per_page?: number; answered?: boolean }) =>
  api.get<{ data: SellerQna[]; pagination: import('./products').Pagination }>('/seller/qna', { params }).then((r) => r.data);

export const answerQna = (qnaId: string, answer: string) =>
  api.post(`/qna/${qnaId}/answer`, { answer }).then((r) => r.data);

export const replyReview = (reviewId: string, reply: string) =>
  api.post(`/seller/reviews/${reviewId}/reply`, { reply }).then((r) => r.data);

export const getSalesStats = () =>
  api.get<{ data: DailySales[] }>('/seller/sales-stats').then((r) => r.data.data);

export interface SellerProfitAnalysis {
  window: string;
  total_revenue: string;
  total_margin: string;
  /** v1.3.11+ — settlement 와 일치하는 effective rate (%) */
  commission_rate_pct?: number;
  commission: string;
  net_profit: string;
  avg_margin_rate: number;
  refund_rate: number;
  dispute_rate: number;
  total_orders: number;
  revenue_orders: number;
  refunded_orders: number;
  disputed_orders: number;
  previous_revenue: string;
}

export const getProfitAnalysis = () =>
  api.get<{ data: SellerProfitAnalysis }>('/seller/profit-analysis').then((r) => r.data.data);

export interface UpdateSellerProfilePayload {
  wallet_address?: string;
  contact_phone?: string;
  seller_type?: string;
  business_name?: string;
  business_number?: string;
  representative_name?: string;
  business_address?: string;
  business_type?: string;
  business_category?: string;
}

export const updateSellerProfile = (data: UpdateSellerProfilePayload) =>
  api.put('/seller/profile', data).then((r) => r.data);

// --- Seller Deposit ---

export interface DepositSubmission {
  id: string;
  seller_id: string;
  txid: string;
  amount: string;
  network: string;
  status: 'pending' | 'verified' | 'rejected' | 'refund_pending' | 'refunded';
  verified_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositStatusResponse {
  submission: DepositSubmission | null;
  required_amount: string;
}

export const submitDeposit = (data: { txid: string; amount: number; network: string }) =>
  api.post('/seller/deposit', data).then((r) => r.data);

export const getDepositStatus = () =>
  api.get<{ data: DepositStatusResponse }>('/seller/deposit/status').then((r) => r.data.data);
