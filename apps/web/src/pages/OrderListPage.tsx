import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { getOrders, type OrderSummary } from '@/lib/api/orders';
import { ORDER_STATUS_LABELS as STATUS_LABELS } from '@/constants/status-maps';

const statusStyle = (status: string) => {
  switch (status) {
    case 'cancelled': return 'bg-red-50 text-red-500 dark:bg-red-500/10';
    case 'confirmed': return 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10';
    default: return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10';
  }
};

export default function OrderListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders(),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <div className="h-8 w-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
        <ShoppingBag className="h-5 w-5" />
        주문 내역
      </h1>

      {(!data?.data || data.data.length === 0) ? (
        <div className="flex flex-col items-center py-16">
          <ShoppingBag className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-[13px] font-bold text-gray-400">주문 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((order: OrderSummary) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center justify-between rounded-2xl border border-gray-300 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <div className="flex-1">
                <p className="text-[14px] font-bold text-gray-900 dark:text-white">
                  {order.first_item_title}{order.item_count > 1 && ` 외 ${order.item_count - 1}건`}
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-gray-400">{order.order_number}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{new Date(order.created_at).toLocaleDateString('ko')}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusStyle(order.status)}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <p className="mt-1 text-[15px] font-bold text-gray-900 dark:text-white">{order.total_amount} USDT</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
