import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { Link } from 'react-router-dom';
import {
  Package, ScanLine, Store, RotateCcw, AlertTriangle, Wallet,
  Users, ShoppingBag, Truck, CheckCircle, Star, TrendingUp,
  ArrowRight, Clock, Settings,
} from 'lucide-react';
import {
  ORDER_STATUS_LABELS as STATUS_LABELS,
  ORDER_STATUS_BAR_COLORS as STATUS_COLORS,
  ORDER_STATUS_COLORS,
} from '@/constants/status-maps';

const STATUS_BADGE: Record<string, string> = {
  ...ORDER_STATUS_COLORS,
  payment_rejected: 'bg-red-100 text-red-800',
};

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.getDashboard().then((r) => r.data.data),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-5 dark:border-gray-800">
              <div className="mb-2 h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-8 w-20 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="mb-2 h-3 w-12 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-7 w-8 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { stats, recent_orders, pending_actions, order_status_breakdown, recent_activities } = data;
  const totalBreakdown = order_status_breakdown?.reduce((sum: number, s: { count: number }) => sum + s.count, 0) || 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">대시보드</h1>

      {/* Revenue Section */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-gray-900 p-5 dark:bg-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 dark:bg-gray-900/10">
              <TrendingUp className="h-4 w-4 text-white dark:text-gray-900" />
            </div>
            <span className="text-[13px] font-medium text-gray-400 dark:text-gray-500">오늘 매출</span>
          </div>
          <p className="mt-3 text-xl font-bold text-white dark:text-gray-900">₮ {Number(stats.today_revenue).toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{stats.today_orders}건</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">7일 매출</span>
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 dark:text-white">₮ {Number(stats.week_revenue).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">30일 매출</span>
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 dark:text-white">₮ {Number(stats.month_revenue).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-500/10">
              <TrendingUp className="h-4 w-4 text-pink-500" />
            </div>
            <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">누적 매출</span>
          </div>
          <p className="mt-3 text-xl font-bold text-pink-500">₮ {Number(stats.total_revenue).toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-gray-400">총 {stats.total_orders}건</p>
        </div>
      </div>

      {/* Pending Actions */}
      <div>
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">처리 필요</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <PendingCard label="상품 심사" count={pending_actions.products} to="/admin/products" icon={<Package className="h-4 w-4" />} color="amber" />
          <PendingCard label="TXID 검증" count={pending_actions.txid} to="/admin/txid" icon={<ScanLine className="h-4 w-4" />} color="amber" />
          <PendingCard label="판매자 승인" count={pending_actions.sellers} to="/admin/sellers" icon={<Store className="h-4 w-4" />} color="gray" />
          <PendingCard label="환불 처리" count={pending_actions.refunds} to="/admin/refunds" icon={<RotateCcw className="h-4 w-4" />} color="red" />
          <PendingCard label="분쟁 진행" count={pending_actions.disputes} to="/admin/disputes" icon={<AlertTriangle className="h-4 w-4" />} color="red" />
          <PendingCard label="출금 대기" count={pending_actions.withdrawals} to="/admin/withdrawals" icon={<Wallet className="h-4 w-4" />} color="emerald" />
        </div>
      </div>

      {/* Quick Stats */}
      <div>
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">운영 현황</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <MiniStat label="전체 회원" value={stats.total_users} sub={`신규 ${stats.new_users_7d}명 (7일)`} icon={<Users className="h-4 w-4 text-gray-400" />} />
          <MiniStat label="활성 판매자" value={stats.active_sellers} icon={<Store className="h-4 w-4 text-gray-400" />} />
          <MiniStat label="전체 상품" value={stats.total_products} sub={`활성 ${stats.active_products}개`} icon={<Package className="h-4 w-4 text-gray-400" />} />
          <MiniStat label="배송 중" value={stats.shipped_orders} icon={<Truck className="h-4 w-4 text-gray-400" />} />
          <MiniStat label="배송 완료" value={stats.delivered_orders} icon={<CheckCircle className="h-4 w-4 text-gray-400" />} />
          <MiniStat label="구매 확정" value={stats.confirmed_orders} icon={<Star className="h-4 w-4 text-gray-400" />} />
        </div>
      </div>

      {/* Two Column: Order Breakdown + Activities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Order Status Breakdown */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">주문 상태 분포</h2>
          </div>
          <div className="p-5">
            {order_status_breakdown && order_status_breakdown.length > 0 ? (
              <div className="space-y-3">
                <div className="flex h-6 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  {order_status_breakdown.map((s: { status: string; count: number }) => {
                    const pct = (s.count / totalBreakdown) * 100;
                    if (pct < 1) return null;
                    return (
                      <div
                        key={s.status}
                        className={`${STATUS_COLORS[s.status] ?? 'bg-gray-300'} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${STATUS_LABELS[s.status] ?? s.status}: ${s.count}건 (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {order_status_breakdown.map((s: { status: string; count: number }) => (
                    <div key={s.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[s.status] ?? 'bg-gray-300'}`} />
                        <span className="text-gray-600 dark:text-gray-400">{STATUS_LABELS[s.status] ?? s.status}</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{s.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">주문 데이터가 없습니다.</p>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">최근 관리 활동</h2>
            <Link to="/admin/logs" className="flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              전체 보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-5">
            {recent_activities && recent_activities.length > 0 ? (
              <div className="space-y-1">
                {recent_activities.map((a: { action: string; target_type: string; detail: string; created_at: string | null }, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                    <ActivityIcon type={a.target_type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-gray-800 dark:text-gray-200">
                        <span className="font-bold">{a.action}</span> · {a.target_type}
                      </p>
                      <p className="truncate text-xs text-gray-400">{a.detail}</p>
                    </div>
                    <span className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {a.created_at ? timeAgo(a.created_at) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">관리 활동 기록이 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">최근 주문</h2>
          <Link to="/admin/orders" className="flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            전체 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</th>
                <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">금액</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">날짜</th>
              </tr>
            </thead>
            <tbody>
              {recent_orders.map((order: { id: string; order_number: string; buyer_name: string; total_amount: string; status: string; created_at: string | null }) => (
                <tr key={order.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-gray-300">{order.order_number}</td>
                  <td className="px-5 py-3 text-gray-900 dark:text-gray-300">{order.buyer_name}</td>
                  <td className="px-5 py-3 text-right font-bold text-pink-500">₮ {Number(order.total_amount).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                </tr>
              ))}
              {recent_orders.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  <ShoppingBag className="mx-auto mb-2 h-10 w-10 text-gray-200" />
                  주문이 없습니다.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Sub Components ─────────────────────────── */

function PendingCard({ label, count, to, icon, color }: { label: string; count: number; to: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, { bg: string; iconBg: string; icon: string }> = {
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', iconBg: 'bg-amber-100 dark:bg-amber-500/20', icon: 'text-amber-500' },
    red: { bg: 'bg-red-50 dark:bg-red-500/10', iconBg: 'bg-red-100 dark:bg-red-500/20', icon: 'text-red-500' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: 'text-emerald-500' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-800', iconBg: 'bg-gray-100 dark:bg-gray-700', icon: 'text-gray-500' },
  };
  const inactive = 'bg-gray-50 dark:bg-gray-800';
  const c = colorMap[color] ?? colorMap.gray;

  return (
    <Link to={to} className={`rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${count > 0 ? c.bg : inactive}`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${count > 0 ? c.iconBg : 'bg-gray-100 dark:bg-gray-700'}`}>
          <span className={count > 0 ? c.icon : 'text-gray-300 dark:text-gray-600'}>{icon}</span>
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-bold ${count > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>
        {count}
      </p>
    </Link>
  );
}

function MiniStat({ label, value, sub, icon }: { label: string; value: number | string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
        {icon}
      </div>
      <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const iconMap: Record<string, { bg: string; icon: React.ReactNode }> = {
    product: { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: <Package className="h-3 w-3" /> },
    order: { bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10', icon: <ShoppingBag className="h-3 w-3" /> },
    user: { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800', icon: <Users className="h-3 w-3" /> },
    seller: { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800', icon: <Store className="h-3 w-3" /> },
    dispute: { bg: 'bg-red-50 text-red-500 dark:bg-red-500/10', icon: <AlertTriangle className="h-3 w-3" /> },
    refund: { bg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10', icon: <RotateCcw className="h-3 w-3" /> },
    withdrawal: { bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10', icon: <Wallet className="h-3 w-3" /> },
    setting: { bg: 'bg-gray-100 text-gray-500 dark:bg-gray-800', icon: <Settings className="h-3 w-3" /> },
  };
  const item = iconMap[type] ?? { bg: 'bg-gray-100 text-gray-500', icon: <Package className="h-3 w-3" /> };

  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.bg}`}>
      {item.icon}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}
