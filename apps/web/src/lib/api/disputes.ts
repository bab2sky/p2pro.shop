import api from './client';

export type DisputeType = 'not_delivered' | 'defective' | 'wrong_item' | 'other';
export type DisputeStatus = 'open' | 'responded' | 'under_review' | 'resolved' | 'closed';
export type DisputeResolution = 'buyer_win' | 'seller_win' | 'partial_refund' | 'mutual_agreement';

export interface Dispute {
  id: string;
  order_id: string;
  order_number?: string;
  complainant_id: string;
  respondent_id: string;
  dispute_type: DisputeType;
  reason: string;
  evidence: string[];
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolution_note: string | null;
  refund_amount: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_role: 'buyer' | 'seller' | 'admin';
  content: string;
  attachments: string[];
  created_at: string;
}

export interface DisputeDetail extends Dispute {
  messages: DisputeMessage[];
}

import type { Pagination } from './types';

// --- User ---

export const createDispute = (data: {
  order_id: string;
  dispute_type: DisputeType;
  reason: string;
  evidence: string[];
}) => api.post<{ data: Dispute }>('/disputes', data).then((r) => r.data);

export const getMyDisputes = () =>
  api.get<{ data: Dispute[] }>('/disputes').then((r) => r.data);

export const getDispute = (id: string) =>
  api.get<{ data: DisputeDetail }>(`/disputes/${id}`).then((r) => r.data);

export const addDisputeMessage = (disputeId: string, data: { content: string; attachments: string[] }) =>
  api.post<{ data: DisputeMessage }>(`/disputes/${disputeId}/messages`, data).then((r) => r.data);

// --- Admin ---

export interface DisputeStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  total_refund_amount: string;
}

export const getAdminDisputeStats = () =>
  api.get<{ data: DisputeStats }>('/admin/disputes/stats').then((r) => r.data);

export const getAdminDisputes = (params?: { status?: string; page?: number }) =>
  api.get<{ data: Dispute[]; pagination: Pagination }>('/admin/disputes', { params }).then((r) => r.data);

export const getAdminDispute = (id: string) =>
  api.get<{ data: DisputeDetail }>(`/admin/disputes/${id}`).then((r) => r.data);

export const resolveDispute = (id: string, data: {
  resolution: DisputeResolution;
  resolution_note: string;
  refund_amount?: number;
}) => api.post<{ data: Dispute }>(`/admin/disputes/${id}/resolve`, data).then((r) => r.data);
