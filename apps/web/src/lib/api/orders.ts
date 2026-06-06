import api from './client';
import type { Pagination } from './types';

export interface OrderSummary {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
  item_count: number;
  first_item_title: string;
  first_item_image: string | null;
  created_at: string;
}

export interface SellerOrderSummary {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
  subtotal: string;
  shipping_fee: string;
  margin_amount: string;
  item_count: number;
  first_item_title: string;
  first_item_image: string | null;
  buyer_nickname: string | null;
  recipient_name: string;
  recipient_phone: string;
  txid: string | null;
  verification_status: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  auto_confirm_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  seller_name: string;
  recipient_name: string;
  recipient_phone: string;
  zipcode: string;
  address1: string;
  address2: string | null;
  shipping_memo: string | null;
  items: OrderItemDetail[];
  subtotal: string;
  shipping_fee: string;
  margin_amount: string;
  total_amount: string;
  company_wallet: string;
  payment_network: string | null;
  txid: string | null;
  timeline: OrderEvent[];
  txid_deadline: string | null;
  created_at: string;
  /** v1.3.6: 모든 아이템이 디지털 카테고리이면 true. 셀러는 운송장 없이 즉시 배송완료 가능. */
  is_digital?: boolean;
}

export interface OrderItemDetail {
  product_id: string;
  product_title: string;
  product_image: string | null;
  option_label: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface OrderEvent {
  status: string;
  label: string;
  timestamp: string;
}

export interface CreateOrderPayload {
  items: { product_id: string; option_id?: string; quantity: number; expected_price?: string }[];
  coupon_id?: string | null;
  address_id?: string;
  orderer_name: string;
  orderer_phone: string;
  recipient_name: string;
  recipient_phone: string;
  zipcode: string;
  address1: string;
  address2?: string;
  shipping_memo?: string;
  payment_network?: string;
}

export const createOrder = (data: CreateOrderPayload) =>
  api.post('/orders', data).then((r) => r.data);

export const getOrders = (params?: { page?: number; per_page?: number; status?: string; date_from?: string; date_to?: string; search?: string }) =>
  api.get<{ data: OrderSummary[]; pagination: Pagination }>('/orders', { params }).then((r) => r.data);

export const getOrder = (id: string) =>
  api.get<{ data: OrderDetail }>(`/orders/${id}`).then((r) => r.data.data);

export const submitTxid = (orderId: string, txid: string) =>
  api.post(`/orders/${orderId}/txid`, { txid }).then((r) => r.data);

export const updatePaymentNetwork = (orderId: string, payment_network: string) =>
  api.put<{ data: { payment_network: string; company_wallet: string } }>(`/orders/${orderId}/network`, { payment_network }).then((r) => r.data.data);

/** 사용 가능한 결제 네트워크 목록 (admin이 지갑 주소 설정한 네트워크만) */
export const getAvailablePaymentNetworks = () =>
  api.get<{ data: string[] }>('/payment-networks').then((r) => r.data.data);

export const getSellerOrders = (params?: { page?: number; per_page?: number; status?: string; date_from?: string; date_to?: string }) =>
  api.get<{ data: SellerOrderSummary[]; pagination: Pagination }>('/seller/orders', { params }).then((r) => r.data);

export interface RegisterShippingPayload {
  carrier_code: string;
  carrier_name: string;
  tracking_number: string;
}

export const registerShipping = (orderId: string, data: RegisterShippingPayload) =>
  api.post(`/seller/orders/${orderId}/shipping`, data).then((r) => r.data);

/** v1.3.6: 디지털 상품(NFT/소프트웨어 등) 즉시 전송완료 처리. 운송장 입력 없이 한 번에 delivered 로 전환. */
export const completeDigitalDelivery = (orderId: string) =>
  api.post(`/seller/orders/${orderId}/digital-delivery`).then((r) => r.data);

export interface DeliveryTracking {
  carrier_name: string;
  tracking_number: string;
  status: string;
  last_detail: string | null;
  estimated_delivery: string | null;
  events: unknown[];
  delivered_at: string | null;
}

export const getDeliveryTracking = (orderId: string) =>
  api.get<{ data: DeliveryTracking }>(`/orders/${orderId}/delivery`).then((r) => r.data.data);

export interface BulkShippingItem {
  order_id: string;
  carrier_code: string;
  carrier_name: string;
  tracking_number: string;
}

export interface BulkShippingResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; order_id: string; reason: string }[];
}

export const bulkRegisterShipping = (items: BulkShippingItem[]) =>
  api.post<{ data: BulkShippingResult }>('/seller/orders/bulk-shipping', { items }).then((r) => r.data.data);
