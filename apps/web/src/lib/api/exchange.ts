import api from './client';

export interface ExchangeRequest {
  id: string;
  order_id: string;
  order_item_id: string;
  reason_code: string;
  reason_detail: string | null;
  desired_option: Record<string, unknown> | null;
  status: string;
  return_tracking_number: string | null;
  return_carrier: string | null;
  new_tracking_number: string | null;
  new_carrier: string | null;
  seller_response: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface OrderInquiry {
  id: string;
  order_id: string;
  inquiry_type: string;
  title: string;
  content: string;
  images: string[];
  status: string;
  seller_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export const createExchange = (data: {
  order_id: string;
  order_item_id: string;
  reason_code: string;
  reason_detail?: string;
  desired_option?: Record<string, unknown>;
}) => api.post<{ data: { id: string } }>('/exchanges', data).then((r) => r.data);

export const getMyExchanges = (params?: { page?: number; per_page?: number }) =>
  api.get<{ data: ExchangeRequest[] }>('/exchanges', { params }).then((r) => r.data);

export const updateExchangeTracking = (id: string, data: { return_tracking_number: string; return_carrier: string }) =>
  api.put(`/exchanges/${id}/tracking`, data).then((r) => r.data);

export const getSellerExchanges = (params?: { page?: number; per_page?: number }) =>
  api.get<{ data: ExchangeRequest[] }>('/seller/exchanges', { params }).then((r) => r.data);

export const respondExchange = (id: string, data: {
  status: string;
  seller_response?: string;
  new_tracking_number?: string;
  new_carrier?: string;
}) => api.put(`/seller/exchanges/${id}/respond`, data).then((r) => r.data);

export const createInquiry = (data: {
  order_id: string;
  inquiry_type: string;
  title: string;
  content: string;
  images?: string[];
}) => api.post<{ data: { id: string } }>('/inquiries', data).then((r) => r.data);

export const getMyInquiries = (params?: { page?: number; per_page?: number }) =>
  api.get<{ data: OrderInquiry[] }>('/inquiries', { params }).then((r) => r.data);

export const getSellerInquiries = (params?: { page?: number; per_page?: number }) =>
  api.get<{ data: OrderInquiry[] }>('/seller/inquiries', { params }).then((r) => r.data);

export const replyInquiry = (id: string, seller_reply: string) =>
  api.put(`/seller/inquiries/${id}/reply`, { seller_reply }).then((r) => r.data);
