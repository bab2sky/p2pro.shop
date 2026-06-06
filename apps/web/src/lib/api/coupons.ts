import api from './client';

// --- Types ---

export interface Coupon {
  id: string;
  name: string;
  code: string;
  coupon_type: 'platform' | 'seller';
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface AvailableCoupon {
  coupon_id: string;
  coupon_name: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  max_discount: number | null;
  calculated_discount: number;
  is_best: boolean;
}

export interface CreateCouponRequest {
  name: string;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_order_amount?: number;
  max_discount?: number;
  max_uses?: number;
  starts_at: string;
  expires_at: string;
}

// --- Seller Coupon CRUD ---

export async function getSellerCoupons(): Promise<Coupon[]> {
  const { data } = await api.get('/seller/coupons');
  return data.data;
}

export async function createSellerCoupon(req: CreateCouponRequest): Promise<{ id: string }> {
  const { data } = await api.post('/seller/coupons', req);
  return data.data;
}

export async function updateSellerCoupon(id: string, req: Partial<CreateCouponRequest>): Promise<void> {
  await api.put(`/seller/coupons/${id}`, req);
}

export async function deleteSellerCoupon(id: string): Promise<void> {
  await api.delete(`/seller/coupons/${id}`);
}

// --- Checkout ---

export async function getAvailableCoupons(orderAmount: number): Promise<AvailableCoupon[]> {
  const { data } = await api.get('/checkout/available-coupons', {
    params: { order_amount: orderAmount },
  });
  return data.data;
}
