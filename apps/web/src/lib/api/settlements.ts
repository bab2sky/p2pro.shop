import api from './client';

export interface SettlementSummary {
  total_sales: string;
  total_commission: string;
  total_settled: string;
  available_amount: string;
  pending_withdrawal: string;
  commission_rate: string;
}

export interface WithdrawalRequest {
  id: string;
  seller_id: string;
  amount: string;
  fee_amount: string | null;
  net_amount: string | null;
  wallet_address: string;
  network: string;
  txid: string | null;
  status: string;
  reject_reason: string | null;
  cancel_reason: string | null;
  admin_memo: string | null;
  processed_by: string | null;
  processed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  requested_at: string;
  seller_name: string | null;
  seller_email: string | null;
}

export interface WithdrawalStats {
  total_pending: number;
  total_approved: number;
  total_completed: number;
  total_rejected: number;
  total_cancelled: number;
  pending_amount: string;
  approved_amount: string;
  completed_amount: string;
  today_completed_amount: string;
  month_completed_amount: string;
}

import type { Pagination } from './types';

export const getSettlementSummary = () =>
  api.get<{ data: SettlementSummary }>('/seller/settlement/summary').then((r) => r.data);

export const getWithdrawalHistory = (params?: { page?: number; per_page?: number }) =>
  api.get<{ data: WithdrawalRequest[]; pagination: Pagination }>('/seller/withdrawal', { params }).then((r) => r.data);

export const createWithdrawal = (data: { amount: string; wallet_address: string; network?: string; totp_code: string }) =>
  api.post('/seller/withdrawal', data).then((r) => r.data);

// Admin
export const getAdminWithdrawals = (params?: { page?: number; per_page?: number; status?: string }) =>
  api.get<{ data: WithdrawalRequest[]; pagination: Pagination }>('/admin/withdrawals', { params }).then((r) => r.data);

export const getWithdrawalStats = () =>
  api.get<{ data: WithdrawalStats }>('/admin/withdrawals/stats').then((r) => r.data);

export const processWithdrawal = (id: string, data: { action: string; reason?: string; txid?: string; memo?: string }) =>
  api.put(`/admin/withdrawals/${id}/process`, data).then((r) => r.data);
