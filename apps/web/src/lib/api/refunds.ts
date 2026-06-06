import api from './client';
import type { Pagination } from './types';

export interface RefundRequestInfo {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  reason_code: string;
  reason: string;
  evidence_images: string[] | null;
  status: string;
  seller_response: string | null;
  seller_reason: string | null;
  seller_responded_at: string | null;
  refund_type: string | null;
  refund_amount: string | null;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  order_number: string | null;
  order_total: string | null;
  order_status: string | null;
  buyer_name: string | null;
  seller_name: string | null;
}

export interface RefundStats {
  total_requested: number;
  pending_seller: number;
  seller_approved: number;
  admin_pending: number;
  completed: number;
  rejected: number;
  total_refunded_amount: string;
}

export interface PaginatedRefunds {
  data: RefundRequestInfo[];
  pagination: Pagination;
}

// Buyer APIs
export const refundApi = {
  create: (orderId: string, body: { reason_code: string; reason: string; evidence_images?: string[] }) =>
    api.post<{ data: { refund_id: string; status: string } }>(`/orders/${orderId}/refund`, body),

  list: (page = 1, perPage = 20) =>
    api.get<PaginatedRefunds>('/refunds', { params: { page, per_page: perPage } }),

  getDetail: (id: string) =>
    api.get<{ data: RefundRequestInfo }>(`/refunds/${id}`),
};

// Seller APIs
export const sellerRefundApi = {
  list: (page = 1, perPage = 20, status?: string) =>
    api.get<PaginatedRefunds>('/seller/refunds', {
      params: { page, per_page: perPage, status },
    }),

  respond: (id: string, body: { action: 'approve' | 'reject'; reason?: string }) =>
    api.put(`/seller/refunds/${id}/respond`, body),
};

// Admin APIs
export const adminRefundApi = {
  list: (page = 1, perPage = 20, status?: string) =>
    api.get<PaginatedRefunds>('/admin/refunds', {
      params: { page, per_page: perPage, status },
    }),

  stats: () =>
    api.get<{ data: RefundStats }>('/admin/refunds/stats'),

  process: (id: string, body: { action: 'approve' | 'reject'; refund_type?: string; refund_amount?: number; note?: string }) =>
    api.put(`/admin/refunds/${id}/process`, body),
};
