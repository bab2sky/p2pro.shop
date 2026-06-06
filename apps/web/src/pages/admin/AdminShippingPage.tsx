import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminShipment, type ShippingStats, type SellerShippingPerf } from '@/lib/api/admin';
import { Search, Package, ChevronLeft, ChevronRight, Truck, Clock, CheckCircle2, ShoppingCart, AlertTriangle, Timer, CalendarClock } from 'lucide-react';

const statusLabels: Record<string, string> = {
  payment_verified: '발송대기',
  shipped: '배송중',
  delivered: '배송완료',
  confirmed: '구매확정',
};

const shippingStatusLabels: Record<string, string> = {
  in_transit: '배송중',
  out_for_delivery: '배달중',
  delivered: '배달완료',
  exception: '배송이상',
};

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function daysSince(d: string | null) {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

type Tab = 'shipments' | 'overdue' | 'sellers';
type Filter = '' | 'awaiting' | 'shipped' | 'delivered' | 'confirmed' | 'exception' | 'overdue';

const STAT_ICONS: { icon: React.ElementType; color: string }[] = [
  { icon: Clock, color: 'yellow' },
  { icon: Truck, color: 'gray' },
  { icon: CheckCircle2, color: 'green' },
  { icon: ShoppingCart, color: 'gray' },
  { icon: AlertTriangle, color: 'red' },
  { icon: AlertTriangle, color: 'red' },
  { icon: Timer, color: 'gray' },
  { icon: CalendarClock, color: 'gray' },
];

export default function AdminShippingPage() {
  const [tab, setTab] = useState<Tab>('shipments');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('');

  const statsQ = useQuery({
    queryKey: ['admin', 'shipping', 'stats'],
    queryFn: () => adminApi.getShippingStats(),
  });

  const shipmentsQ = useQuery({
    queryKey: ['admin', 'shipping', 'list', page, filter, search, sort],
    queryFn: () => adminApi.getShipments(page, 20, filter || undefined, search || undefined, sort || undefined),
    enabled: tab === 'shipments',
  });

  const overdueQ = useQuery({
    queryKey: ['admin', 'shipping', 'overdue', page],
    queryFn: () => adminApi.getOverdueShipments(page, 20),
    enabled: tab === 'overdue',
  });

  const sellersQ = useQuery({
    queryKey: ['admin', 'shipping', 'sellers', sort],
    queryFn: () => adminApi.getSellerShippingPerformance(1, 50, sort || undefined),
    enabled: tab === 'sellers',
  });

  const stats: ShippingStats | undefined = statsQ.data?.data?.data;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">배송 관리</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {([
            { label: '발송대기', value: stats.awaiting_shipment, highlight: stats.awaiting_shipment > 0 },
            { label: '배송중', value: stats.in_transit },
            { label: '배송완료', value: stats.delivered },
            { label: '구매확정', value: stats.confirmed },
            { label: '지연 발송', value: stats.overdue, highlight: stats.overdue > 0 },
            { label: '배송이상', value: stats.exceptions, highlight: stats.exceptions > 0 },
            { label: '평균 발송일', value: `${stats.avg_ship_days_30d.toFixed(1)}일` },
            { label: '주간 주문', value: stats.week_orders },
          ] as { label: string; value: number | string; highlight?: boolean }[]).map((item, idx) => {
            const { icon: Icon, color } = STAT_ICONS[idx];
            return (
              <StatCard key={item.label} label={item.label} value={item.value} highlight={item.highlight} icon={Icon} color={color} />
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([
          ['shipments', '배송 현황'],
          ['overdue', '지연 주문'],
          ['sellers', '판매자 배송 성과'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(1); setFilter(''); setSort(''); }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${
              tab === key ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {label}
            {key === 'overdue' && stats && stats.overdue > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{stats.overdue}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'shipments' && (
        <ShipmentList
          data={shipmentsQ.data?.data}
          isLoading={shipmentsQ.isLoading}
          page={page}
          setPage={setPage}
          filter={filter}
          setFilter={(f) => { setFilter(f); setPage(1); }}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSearch={handleSearch}
          sort={sort}
          setSort={setSort}
        />
      )}

      {tab === 'overdue' && (
        <OverdueList
          data={overdueQ.data?.data}
          isLoading={overdueQ.isLoading}
          page={page}
          setPage={setPage}
        />
      )}

      {tab === 'sellers' && (
        <SellerPerformance
          data={sellersQ.data?.data?.data}
          isLoading={sellersQ.isLoading}
          sort={sort}
          setSort={setSort}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, highlight, icon: Icon, color }: { label: string; value: number | string; highlight?: boolean; icon: React.ElementType; color: string }) {
  const iconBgMap: Record<string, string> = {
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
    gray: 'bg-gray-100 dark:bg-gray-800',
    green: 'bg-green-50 dark:bg-green-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
  };
  const iconTextMap: Record<string, string> = {
    yellow: 'text-yellow-600 dark:text-yellow-400',
    gray: 'text-gray-500 dark:text-gray-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className={`rounded-2xl bg-gray-50 p-4 dark:bg-gray-900 ${highlight ? 'ring-2 ring-gray-900/10 dark:ring-white/10' : ''}`}>
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBgMap[color]}`}>
          <Icon className={`h-4 w-4 ${iconTextMap[color]}`} />
        </div>
      </div>
      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

interface ShipmentListProps {
  data: { data: AdminShipment[]; pagination: { page: number; total_pages: number; total: number } } | undefined;
  isLoading: boolean;
  page: number;
  setPage: (p: number) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  searchInput: string;
  setSearchInput: (s: string) => void;
  onSearch: (e: React.FormEvent) => void;
  sort: string;
  setSort: (s: string) => void;
}

function ShipmentList({ data, isLoading, page, setPage, filter, setFilter, searchInput, setSearchInput, onSearch, sort, setSort }: ShipmentListProps) {
  const filters: [Filter, string][] = [
    ['', '전체'],
    ['awaiting', '발송대기'],
    ['shipped', '배송중'],
    ['delivered', '배송완료'],
    ['confirmed', '구매확정'],
    ['exception', '배송이상'],
    ['overdue', '지연'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {filters.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                filter === key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="relative ml-auto flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="주문번호, 운송장, 이름 검색"
              className="w-60 rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <button type="submit" className="rounded-full bg-gray-900 px-3 py-2 text-sm font-bold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">검색</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">금액</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문상태</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">택배사</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">운송장</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">배송상태</th>
              <th className="cursor-pointer px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400" onClick={() => setSort(sort === 'ordered_asc' ? '' : 'ordered_asc')}>
                주문일 {sort === 'ordered_asc' ? '↑' : '↓'}
              </th>
              <th className="cursor-pointer px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400" onClick={() => setSort(sort === 'shipped_desc' ? 'shipped_asc' : 'shipped_desc')}>
                발송일 {sort === 'shipped_asc' ? '↑' : '↓'}
              </th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">배송완료</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} className="px-5 py-16 text-center">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="mx-auto h-8 max-w-xl animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              </td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={11} className="px-5 py-16 text-center">
                <Package className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                <p className="mt-3 font-bold text-gray-400">데이터가 없습니다</p>
              </td></tr>
            ) : data.data.map((s) => (
              <tr key={s.order_id} className={`border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50 ${
                s.order_status === 'payment_verified' && daysSince(s.ordered_at) >= 3 ? 'bg-red-50/50 dark:bg-red-900/10' : ''
              }`}>
                <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-white">{s.order_number}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{s.buyer_name || '-'}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{s.seller_name || '-'}</td>
                <td className="px-5 py-3 font-bold text-pink-500">{s.total_amount ? `$${Number(s.total_amount).toFixed(2)}` : '-'}</td>
                <td className="px-5 py-3">
                  <OrderStatusBadge status={s.order_status} />
                </td>
                <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300">{s.carrier_name || '-'}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{s.tracking_number || '-'}</td>
                <td className="px-5 py-3">
                  {s.shipping_status ? (
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      s.shipping_status === 'exception' ? 'bg-red-100 text-red-700' :
                      s.shipping_status === 'delivered' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {shippingStatusLabels[s.shipping_status] || s.shipping_status}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(s.ordered_at)}</td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(s.shipped_at)}</td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(s.delivered_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.pagination && data.pagination.total_pages > 1 && (
        <Pager page={page} totalPages={data.pagination.total_pages} setPage={setPage} />
      )}
    </div>
  );
}

interface OverdueListProps {
  data: { data: AdminShipment[]; pagination: { page: number; total_pages: number; total: number } } | undefined;
  isLoading: boolean;
  page: number;
  setPage: (p: number) => void;
}

function OverdueList({ data, isLoading, page, setPage }: OverdueListProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">결제 확인 후 2일 이상 발송하지 않은 주문 목록입니다.</p>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">금액</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문일</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">경과일</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="mx-auto h-8 max-w-xl animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              </td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center">
                <Truck className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                <p className="mt-3 font-bold text-green-600">지연 주문이 없습니다</p>
              </td></tr>
            ) : data.data.map((s) => {
              const days = daysSince(s.ordered_at);
              return (
                <tr key={s.order_id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-white">{s.order_number}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{s.buyer_name || '-'}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{s.seller_name || '-'}</td>
                  <td className="px-5 py-3 font-bold text-pink-500">{s.total_amount ? `$${Number(s.total_amount).toFixed(2)}` : '-'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(s.ordered_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      days >= 5 ? 'bg-red-600 text-white' : days >= 3 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {days}일 경과
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data?.pagination && data.pagination.total_pages > 1 && (
        <Pager page={page} totalPages={data.pagination.total_pages} setPage={setPage} />
      )}
    </div>
  );
}

interface SellerPerfProps {
  data: SellerShippingPerf[] | undefined;
  isLoading: boolean;
  sort: string;
  setSort: (s: string) => void;
}

function SellerPerformance({ data, isLoading, sort, setSort }: SellerPerfProps) {
  const toggleSort = (key: string) => {
    const asc = key + '_asc';
    const desc = key + '_desc';
    setSort(sort === desc ? asc : desc);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">최근 90일간 판매자별 배송 성과 지표입니다.</p>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
              <th className="cursor-pointer px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400" onClick={() => toggleSort('orders')}>
                총 주문 {sort.startsWith('orders') ? (sort.endsWith('asc') ? '↑' : '↓') : ''}
              </th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">발송완료</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">배송완료</th>
              <th className="cursor-pointer px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400" onClick={() => toggleSort('avg_ship')}>
                평균 발송일 {sort.startsWith('avg_ship') ? (sort.endsWith('asc') ? '↑' : '↓') : ''}
              </th>
              <th className="cursor-pointer px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400" onClick={() => toggleSort('on_time')}>
                3일 내 발송률 {sort.startsWith('on_time') ? (sort.endsWith('asc') ? '↑' : '↓') : ''}
              </th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">배송이상</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">미발송</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-5 py-16 text-center">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="mx-auto h-8 max-w-xl animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              </td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={8} className="px-5 py-16 text-center">
                <Package className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                <p className="mt-3 font-bold text-gray-400">데이터가 없습니다</p>
              </td></tr>
            ) : data.map((s) => (
              <tr key={s.seller_id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                <td className="px-5 py-3 font-bold text-gray-900 dark:text-white">{s.seller_name || '-'}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{s.total_orders ?? 0}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{s.shipped_count ?? 0}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{s.delivered_count ?? 0}</td>
                <td className="px-5 py-3">
                  {s.avg_ship_days != null ? (
                    <span className={`font-bold ${s.avg_ship_days > 3 ? 'text-red-600' : 'text-green-600'}`}>
                      {s.avg_ship_days.toFixed(1)}일
                    </span>
                  ) : '-'}
                </td>
                <td className="px-5 py-3">
                  {s.on_time_rate != null ? (
                    <span className={`font-bold ${s.on_time_rate < 70 ? 'text-red-600' : s.on_time_rate >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {s.on_time_rate.toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
                <td className="px-5 py-3">
                  {(s.exception_count ?? 0) > 0 ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">{s.exception_count}</span>
                  ) : '0'}
                </td>
                <td className="px-5 py-3">
                  {(s.pending_ship_count ?? 0) > 0 ? (
                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-bold text-yellow-700">{s.pending_ship_count}</span>
                  ) : '0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    payment_verified: 'bg-yellow-100 text-yellow-800',
    shipped: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    delivered: 'bg-green-100 text-green-800',
    confirmed: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

function Pager({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => setPage(page - 1)}
        disabled={page <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-bold text-gray-500">{page} / {totalPages}</span>
      <button
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
