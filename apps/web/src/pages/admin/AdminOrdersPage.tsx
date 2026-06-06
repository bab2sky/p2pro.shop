import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Search, X, Clock, ScanLine, CheckCircle, Truck, Star, XCircle, TrendingUp, Download } from 'lucide-react';
import api from '@/lib/api/client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/constants/status-maps';

interface AdminOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
  subtotal: string;
  shipping_fee: string;
  margin_amount: string;
  courier_name: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  seller_name: string | null;
}

interface OrderStats {
  total: number;
  pending_payment: number;
  pending_txid: number;
  payment_verified: number;
  shipped: number;
  delivered: number;
  confirmed: number;
  cancelled: number;
  total_revenue: string;
}

interface OrderDetail {
  order: AdminOrder;
  items: { product_title: string; option_label: string | null; unit_price: string; quantity: number; subtotal: string }[];
}

const statusLabels = ORDER_STATUS_LABELS;
const statusColors = ORDER_STATUS_COLORS;

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Filter = '' | 'pending_payment' | 'pending_txid' | 'payment_verified' | 'shipped' | 'delivered' | 'confirmed' | 'cancelled';

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<Filter>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ['admin', 'orders', 'stats'],
    queryFn: () => api.get<{ data: OrderStats }>('/admin/orders/stats').then((r) => r.data.data),
  });

  const listQ = useQuery({
    queryKey: ['admin', 'orders', 'list', page, filter, search],
    queryFn: () =>
      api.get<{ data: AdminOrder[]; pagination: { page: number; per_page: number; total: number; total_pages: number } }>(
        '/admin/orders',
        { params: { page, per_page: 20, status: filter || undefined, q: search || undefined } },
      ).then((r) => r.data),
  });

  const detailQ = useQuery({
    queryKey: ['admin', 'orders', 'detail', detailId],
    queryFn: () => api.get<{ data: OrderDetail }>(`/admin/orders/${detailId}`).then((r) => r.data.data),
    enabled: !!detailId,
  });

  const stats = statsQ.data;
  const orders = listQ.data?.data ?? [];
  const pagination = listQ.data?.pagination;

  const filters: { value: Filter; label: string }[] = [
    { value: '', label: '전체' },
    { value: 'pending_payment', label: '결제 대기' },
    { value: 'pending_txid', label: 'TXID 대기' },
    { value: 'payment_verified', label: '결제 완료' },
    { value: 'shipped', label: '배송 중' },
    { value: 'delivered', label: '배송 완료' },
    { value: 'confirmed', label: '구매 확정' },
    { value: 'cancelled', label: '취소' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">주문 관리</h1>

      {/* Stats Cards */}
      {statsQ.isLoading && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="mb-2 h-3 w-12 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-6 w-8 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          <StatCard label="전체 주문" value={stats.total} icon={<ShoppingBag className="h-4 w-4 text-gray-400" />} />
          <StatCard label="결제 대기" value={stats.pending_payment} icon={<Clock className="h-4 w-4 text-gray-400" />} />
          <StatCard label="TXID 대기" value={stats.pending_txid} accent="amber" icon={<ScanLine className="h-4 w-4 text-amber-500" />} />
          <StatCard label="결제 완료" value={stats.payment_verified} accent="emerald" icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} />
          <StatCard label="배송 중" value={stats.shipped} accent="gray-900" icon={<Truck className="h-4 w-4 text-gray-500" />} />
          <StatCard label="배송 완료" value={stats.delivered} accent="emerald" icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} />
          <StatCard label="구매 확정" value={stats.confirmed} accent="emerald" icon={<Star className="h-4 w-4 text-emerald-500" />} />
          <StatCard label="취소" value={stats.cancelled} accent="red" icon={<XCircle className="h-4 w-4 text-red-500" />} />
          <div className="rounded-2xl bg-pink-50 p-4 dark:bg-pink-500/10">
            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-500/20">
              <TrendingUp className="h-3.5 w-3.5 text-pink-500" />
            </div>
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">총 매출</p>
            <p className="text-lg font-bold text-pink-500">
              ₮ {Number(stats.total_revenue).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="주문번호, 구매자, 판매자 검색..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-72 rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-600"
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await api.get('/admin/orders/export', {
                params: { status: filter || undefined, q: search || undefined },
                responseType: 'blob',
              });
              const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12);
              a.download = `orders_${ts}.xlsx`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            } catch (e) {
              alert('엑셀 다운로드에 실패했습니다.');
              console.error(e);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          title="현재 필터/검색 조건의 주문 목록을 엑셀로 다운로드"
        >
          <Download className="h-4 w-4" />
          엑셀 다운로드
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${
              filter === f.value
                ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {f.label}
            {stats && f.value && (
              <span className="ml-1 text-xs text-gray-400">
                ({stats[f.value as keyof OrderStats] ?? 0})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">금액</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">마진</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">배송정보</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문일</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상세</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-gray-300">{o.order_number}</td>
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-300">{o.buyer_name ?? '-'}</div>
                  <div className="text-xs text-gray-400">{o.buyer_email}</div>
                </td>
                <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{o.seller_name ?? '-'}</td>
                <td className="px-5 py-3 whitespace-nowrap text-right font-bold text-pink-500">₮ {Number(o.total_amount).toLocaleString()}</td>
                <td className="px-5 py-3 whitespace-nowrap text-right text-gray-500">₮ {Number(o.margin_amount).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColors[o.status] ?? 'bg-gray-100'}`}>
                    {statusLabels[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs">
                  {o.courier_name ? (
                    <div className="text-gray-700 dark:text-gray-300">
                      <span>{o.courier_name}</span>
                      {o.tracking_number && <span className="ml-1 text-gray-400">{o.tracking_number}</span>}
                    </div>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">-</span>
                  )}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-500">{formatDate(o.created_at)}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => setDetailId(o.id)}
                    className="rounded-full bg-gray-900 px-3.5 py-1 text-xs font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    상세
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center text-gray-400">
                  <ShoppingBag className="mx-auto mb-3 h-14 w-14 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-bold">주문이 없습니다.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: Math.min(pagination.total_pages, 10) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                p === page
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailId(null)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            {detailQ.isLoading ? (
              <p className="py-8 text-center text-gray-500">로딩 중...</p>
            ) : detailQ.data ? (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">주문 상세</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColors[detailQ.data.order.status] ?? 'bg-gray-100'}`}>
                    {statusLabels[detailQ.data.order.status] ?? detailQ.data.order.status}
                  </span>
                </div>

                <dl className="mb-5 space-y-2.5 text-sm">
                  <Row label="주문번호" value={detailQ.data.order.order_number} />
                  <Row label="구매자" value={`${detailQ.data.order.buyer_name ?? ''} (${detailQ.data.order.buyer_email ?? ''})`} />
                  <Row label="판매자" value={detailQ.data.order.seller_name ?? '-'} />
                  <Row label="주문일" value={formatDate(detailQ.data.order.created_at)} />
                  {detailQ.data.order.shipped_at && <Row label="발송일" value={formatDate(detailQ.data.order.shipped_at)} />}
                  {detailQ.data.order.delivered_at && <Row label="배송완료" value={formatDate(detailQ.data.order.delivered_at)} />}
                  {detailQ.data.order.confirmed_at && <Row label="구매확정" value={formatDate(detailQ.data.order.confirmed_at)} />}
                  {detailQ.data.order.cancelled_at && (
                    <>
                      <Row label="취소일" value={formatDate(detailQ.data.order.cancelled_at)} />
                      <Row label="취소사유" value={detailQ.data.order.cancel_reason ?? '-'} />
                    </>
                  )}
                  {detailQ.data.order.courier_name && (
                    <Row label="배송" value={`${detailQ.data.order.courier_name} ${detailQ.data.order.tracking_number ?? ''}`} />
                  )}
                </dl>

                <div className="mb-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">주문 상품</h3>
                  {detailQ.data.items.map((item, i) => (
                    <div key={i} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0 dark:border-gray-800/50">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-200">{item.product_title}</p>
                        {item.option_label && <p className="text-xs text-gray-500">{item.option_label}</p>}
                        <p className="text-xs text-gray-400">₮ {item.unit_price} x {item.quantity}</p>
                      </div>
                      <p className="font-bold text-pink-500">₮ {item.subtotal}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 border-t border-gray-100 pt-4 text-sm dark:border-gray-800">
                  <div className="flex justify-between"><span className="text-gray-500">상품금액</span><span className="text-gray-900 dark:text-white">₮ {Number(detailQ.data.order.subtotal).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">배송비</span><span className="text-gray-900 dark:text-white">₮ {Number(detailQ.data.order.shipping_fee).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">마진</span><span className="text-gray-900 dark:text-white">₮ {Number(detailQ.data.order.margin_amount).toLocaleString()}</span></div>
                  <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base font-bold dark:border-gray-800">
                    <span className="text-gray-900 dark:text-white">총 결제금액</span>
                    <span className="text-pink-500">₮ {Number(detailQ.data.order.total_amount).toLocaleString()}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-gray-400">주문을 찾을 수 없습니다.</p>
            )}

            <button
              onClick={() => setDetailId(null)}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-100 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: number; accent?: string; icon?: React.ReactNode }) {
  const bgMap: Record<string, string> = {
    amber: 'bg-amber-50 dark:bg-amber-500/10',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10',
    red: 'bg-red-50 dark:bg-red-500/10',
    'gray-900': 'bg-gray-100 dark:bg-gray-800',
  };
  const textColor = accent === 'amber' ? 'text-amber-600' : accent === 'emerald' ? 'text-emerald-600' : accent === 'red' ? 'text-red-500' : accent === 'gray-900' ? 'text-gray-900 dark:text-white' : '';
  return (
    <div className={`rounded-2xl p-4 ${accent ? bgMap[accent] ?? 'bg-gray-50 dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-900'}`}>
      {icon && <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 dark:bg-gray-800/60">{icon}</div>}
      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${textColor || 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}
