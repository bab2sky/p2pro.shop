import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';

export interface CouponDetail {
  id: string;
  name: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_order_amount?: number;
  max_discount?: number;
}

export interface UserCoupon {
  id: string;
  coupon: CouponDetail;
  expires_at: string;
  used_at?: string | null;
}

export function useCoupons(status: 'available' | 'used' | 'expired' = 'available') {
  return useQuery<UserCoupon[]>({
    queryKey: ['my-coupons', status],
    queryFn: async () => {
      const res = await api.get('/coupons/my', { params: { status } });
      return res.data.data;
    },
  });
}

export function useClaimCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post('/coupons/claim', { code });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
    },
  });
}
