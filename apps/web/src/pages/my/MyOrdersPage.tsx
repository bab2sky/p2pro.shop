import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Search, ChevronRight } from 'lucide-react';
import { getOrders } from '@/lib/api/orders';
import type { OrderSummary } from '@/lib/api/orders';
import { ORDER_STATUS_LABELS } from '@/constants/status-maps';

const datePresets = [
  { label: '1주', days: 7 },
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '전체', days: 0 },
];

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'pending_payment', label: '결제대기' },
  { value: 'payment_verified', label: '결제확인' },
  { value: 'shipped', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'confirmed', label: '구매확정' },
  { value: 'cancelled', label: '취소' },
];

function getDateFrom(days: number): string | undefined {
  if (days === 0) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export default function MyOrdersPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [activeDays, setActiveDays] = useState(0);
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const dateFrom = getDateFrom(activeDays);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { page, status, dateFrom, search }],
    queryFn: () =>
      getOrders({
        page,
        per_page: 20,
        status: status || undefined,
        date_from: dateFrom,
        search: search || undefined,
      }),
  });

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">주문 내역</h1>

      {/* Filters */}
      <div className="mb-5 space-y-3">
        {/* Date presets */}
        <div className="flex flex-wrap gap-1.5">
          {datePresets.map((p) => (
            <button
              key={p.days}
              onClick={() => { setActiveDays(p.days); setPage(1); }}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all ${
                activeDays === p.days
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Status + Search */}
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-xl border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-medium text-gray-700 outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('mypage.myOrdersSearchPlaceholder', '주문번호 또는 상품명 검색')}
              className="w-full rounded-xl bg-gray-50 py-2.5 pl-9 pr-3 text-[13px] font-medium text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Order list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 88 }} />
          ))}
        </div>
      ) : !data?.data || data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ShoppingBag className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">주문 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {data.data.map((order: OrderSummary) => (
              <Link
                key={order.id}
                to={`/my/orders/${order.id}`}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                  {order.first_item_image ? (
                    <img src={order.first_item_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                    {order.first_item_title}
                    {(order.item_count ?? 0) > 1 && ` 외 ${(order.item_count ?? 1) - 1}건`}
                  </p>
                  <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                    {order.order_number} · {new Date(order.created_at).toLocaleDateString('ko')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      order.status === 'cancelled'
                        ? 'bg-red-50 text-red-500 dark:bg-red-500/10'
                        : order.status === 'confirmed'
                          ? 'bg-green-50 text-green-500 dark:bg-green-500/10'
                          : order.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </span>
                  <p className="mt-1 text-[15px] font-bold text-gray-900 dark:text-white">
                    ₮ {Number(order.total_amount).toLocaleString()}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data.pagination && data.pagination.total_pages > 1 && (
            <div className="mt-6 flex justify-center gap-1.5">
              {Array.from({ length: data.pagination.total_pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 min-w-[2rem] rounded-full text-[13px] font-bold transition-all ${
                    p === page
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
