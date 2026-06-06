import api from './client';

export interface DashboardData {
  user: {
    nickname: string | null;
    profile_image: string | null;
    created_at: string;
    is_udg_member: boolean | null;
  };
  order_counts: {
    pending_payment: number;
    payment_verified: number;
    shipped: number;
    delivered: number;
    confirmed: number;
  };
  recent_orders: {
    id: string;
    order_number: string;
    status: string;
    total_amount: string;
    first_item_title: string | null;
    first_item_image: string | null;
    item_count: number;
    created_at: string;
  }[];
  coupon_count: number;
  wishlist_count: number;
  total_orders: number;
  total_spent: string;
}

export const getDashboard = () =>
  api.get<{ data: DashboardData }>('/my/dashboard').then((r) => r.data.data);

export const confirmOrder = (orderId: string) =>
  api.post(`/orders/${orderId}/confirm`).then((r) => r.data);

export const cancelOrder = (orderId: string) =>
  api.post(`/orders/${orderId}/cancel`).then((r) => r.data);
