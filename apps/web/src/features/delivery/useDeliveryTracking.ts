import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';

export function useDeliveryTracking(orderId: string) {
  return useQuery({
    queryKey: ['delivery-tracking', orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}/delivery`);
      return res.data.data;
    },
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 min
    retry: false,
  });
}
