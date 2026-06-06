import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  CalendarDays,
  ShoppingBag,
  CheckCircle,
  Truck,
  Clock,
  MessageCircle,
  Star,
  Wallet,
  ChevronRight,
  AlertTriangle,
  XCircle,
  Ban,
} from 'lucide-react';
import { getMySellerProfile, getDashboardStats } from '@/lib/api/seller';
import { getSellerOrders } from '@/lib/api/orders';
import { useAuthStore } from '@/stores/auth';

export default function SellerDashboardPage() {
  const { t } = useTranslation('seller');
  const user = useAuthStore((s) => s.user);
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['sellerProfile'],
    queryFn: getMySellerProfile,
  });

  const { data: stats } = useQuery({
    queryKey: ['sellerDashboardStats'],
    queryFn: getDashboardStats,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['sellerOrders', { page: 1 }],
    queryFn: () => getSellerOrders({ page: 1, per_page: 5 }),
  });

  if (profileLoading)
    return (
      <div className="max-w-6xl space-y-4 py-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 100 }} />
        ))}
      </div>
    );

  const seller = profile?.data;

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">{t('dashboardPage.title')}</h1>

      {/* Status alert banners */}
      {seller && seller.status === 'pending' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-5 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-400">{t('dashboardPage.pendingApproval')}</p>
            <p className="mt-1 text-[13px] text-amber-700 dark:text-amber-500">{t('dashboardPage.pendingApprovalDesc')}</p>
          </div>
        </div>
      )}
      {seller && seller.status === 'rejected' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-red-50 p-5 dark:bg-red-500/10">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-bold text-red-800 dark:text-red-400">{t('dashboardPage.rejected')}</p>
            {seller.rejected_reason && (
              <p className="mt-1 text-[13px] text-red-700 dark:text-red-400">{t('dashboardPage.rejectedReason', { reason: seller.rejected_reason })}</p>
            )}
          </div>
        </div>
      )}
      {seller && seller.status === 'suspended' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-red-50 p-5 dark:bg-red-500/10">
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-bold text-red-800 dark:text-red-400">{t('dashboardPage.suspended')}</p>
            {seller.rejected_reason && (
              <p className="mt-1 text-[13px] text-red-700 dark:text-red-400">{t('dashboardPage.rejectedReason', { reason: seller.rejected_reason })}</p>
            )}
            <p className="mt-1 text-[13px] text-red-600 dark:text-red-400">{t('dashboardPage.suspendedDesc')}</p>
          </div>
        </div>
      )}

      {/* Profile summary */}
      {seller && (
        <div className="mb-6 rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white dark:bg-white dark:text-gray-900">
                {(user?.nickname || 'S')[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{user?.nickname || t('dashboardPage.myStore')}</h2>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    seller.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                      : seller.status === 'pending'
                        ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'
                        : 'bg-red-50 text-red-500 dark:bg-red-500/10'
                  }`}>
                    {seller.status === 'approved' ? t('dashboardPage.statusApproved') :
                      seller.status === 'pending' ? t('dashboardPage.statusPending') :
                      seller.status === 'rejected' ? t('dashboardPage.statusRejected') :
                      seller.status === 'suspended' ? t('dashboardPage.statusSuspended') : seller.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboardPage.gradeLv', { level: seller.grade ?? 1 })}</p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-sm font-bold text-gray-900 dark:text-white">
                <Star className="h-3.5 w-3.5 text-amber-400" />
                {seller.avg_rating ?? '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sales summary cards */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-500/10">
                <TrendingUp className="h-4 w-4 text-pink-500" />
              </div>
              <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('dashboardPage.todaySales')}</span>
            </div>
            <p className="mt-3 text-xl font-bold text-pink-500">₮ {Number(stats.today_sales ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
                <CalendarDays className="h-4 w-4 text-purple-500" />
              </div>
              <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('dashboardPage.monthSales')}</span>
            </div>
            <p className="mt-3 text-xl font-bold text-gray-900 dark:text-white">₮ {Number(stats.month_sales ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <ShoppingBag className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('dashboardPage.totalOrders')}</span>
            </div>
            <p className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{stats.total_orders}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
                <CheckCircle className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('dashboardPage.confirmed')}</span>
            </div>
            <p className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{stats.confirmed_orders}</p>
          </div>
        </div>
      )}

      {/* To-Do list */}
      {stats && (
        <div className="mb-6 rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
          <h2 className="mb-4 text-base font-bold text-gray-900 dark:text-white">{t('dashboardPage.todoTitle')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TodoItem to="/seller/orders/shipping" label={t('dashboardPage.todoShipping')} count={stats.pending_orders} icon={<Truck className="h-5 w-5" />} color="red" />
            <TodoItem to="/seller/orders/confirm" label={t('dashboardPage.todoConfirm')} count={stats.delivered_orders} icon={<Clock className="h-5 w-5" />} color="amber" />
            <TodoItem to="/seller/qna" label={t('dashboardPage.todoQna')} count={stats.unanswered_qna} icon={<MessageCircle className="h-5 w-5" />} color="orange" />
            <TodoItem to="/seller/reviews" label={t('dashboardPage.todoReviews')} count={stats.new_reviews} icon={<Star className="h-5 w-5" />} color="purple" />
          </div>
        </div>
      )}

      {/* Product status */}
      {stats && (
        <div className="mb-6 rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('dashboardPage.productStatus')}</h2>
            <Link to="/seller/products" className="flex items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              {t('dashboardPage.viewAll')} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-800">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_products}</p>
              <p className="mt-1 text-[12px] font-medium text-gray-400">{t('dashboardPage.productTotal')}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
              <p className="text-2xl font-bold text-emerald-500">{stats.active_products}</p>
              <p className="mt-1 text-[12px] font-medium text-gray-400">{t('dashboardPage.productActive')}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 text-center dark:bg-amber-500/10">
              <p className="text-2xl font-bold text-amber-500">{stats.pending_products}</p>
              <p className="mt-1 text-[12px] font-medium text-gray-400">{t('dashboardPage.productPending')}</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-4 text-center dark:bg-red-500/10">
              <p className="text-2xl font-bold text-red-500">
                {stats.total_products - stats.active_products - stats.pending_products}
              </p>
              <p className="mt-1 text-[12px] font-medium text-gray-400">{t('dashboardPage.productRejected')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Order management shortcuts */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Link
          to="/seller/orders"
          className="group rounded-2xl border border-gray-300 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-600 dark:bg-gray-900"
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors group-hover:bg-gray-900 group-hover:text-white dark:bg-gray-800 dark:group-hover:bg-white dark:group-hover:text-gray-900">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('dashboardPage.orderManage')}</p>
          <p className="mt-1 text-[12px] text-gray-400">{t('dashboardPage.orderManageDesc')}</p>
        </Link>
        <Link
          to="/seller/orders/shipping"
          className="group rounded-2xl border border-gray-300 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-600 dark:bg-gray-900"
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors group-hover:bg-gray-900 group-hover:text-white dark:bg-gray-800 dark:group-hover:bg-white dark:group-hover:text-gray-900">
            <Truck className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('dashboardPage.shippingManage')}</p>
          <p className="mt-1 text-[12px] text-gray-400">{t('dashboardPage.shippingManageDesc')}</p>
        </Link>
        <Link
          to="/seller/settlement"
          className="group rounded-2xl border border-gray-300 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-600 dark:bg-gray-900"
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors group-hover:bg-gray-900 group-hover:text-white dark:bg-gray-800 dark:group-hover:bg-white dark:group-hover:text-gray-900">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('dashboardPage.settlementManage')}</p>
          <p className="mt-1 text-[12px] text-gray-400">{t('dashboardPage.settlementManageDesc')}</p>
        </Link>
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('dashboardPage.recentOrders')}</h2>
          <Link to="/seller/orders" className="flex items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            {t('dashboardPage.viewAll')} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {ordersData?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <ShoppingBag className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{t('dashboardPage.noOrders')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {ordersData?.data.map((order) => (
              <Link
                key={order.id}
                to={`/seller/orders/${order.id}`}
                className="flex items-center justify-between rounded-xl px-3 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{order.order_number}</p>
                  <p className="mt-0.5 truncate text-[12px] text-gray-400 dark:text-gray-500">
                    {order.first_item_title} {order.item_count > 1 ? t('dashboardPage.otherItems', { count: order.item_count - 1 }) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">₮ {order.total_amount}</p>
                    <StatusBadge status={order.status} t={t} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TodoItem({ to, label, count, icon, color }: { to: string; label: string; count: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, { active: string; icon: string }> = {
    red: { active: 'bg-red-50 dark:bg-red-500/10', icon: 'text-red-500' },
    amber: { active: 'bg-amber-50 dark:bg-amber-500/10', icon: 'text-amber-500' },
    orange: { active: 'bg-orange-50 dark:bg-orange-500/10', icon: 'text-orange-500' },
    purple: { active: 'bg-purple-50 dark:bg-purple-500/10', icon: 'text-purple-500' },
  };
  const colors = colorMap[color] || colorMap.purple;
  const isActive = count > 0;

  return (
    <Link
      to={to}
      className={`flex flex-col items-center rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isActive ? colors.active : 'bg-gray-50 dark:bg-gray-800'
      }`}
    >
      <span className={isActive ? colors.icon : 'text-gray-300 dark:text-gray-600'}>{icon}</span>
      <p className={`mt-2 text-2xl font-bold ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>{count}</p>
      <p className="mt-1 text-[12px] font-medium text-gray-400">{label}</p>
    </Link>
  );
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const map: Record<string, { key: string; color: string }> = {
    pending_payment: { key: 'statusMap.pendingPayment', color: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' },
    txid_submitted: { key: 'statusMap.txidSubmitted', color: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10' },
    payment_verified: { key: 'statusMap.paymentVerified', color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
    paid: { key: 'statusMap.paid', color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
    preparing: { key: 'statusMap.preparing', color: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10' },
    shipped: { key: 'statusMap.shipped', color: 'bg-pink-50 text-pink-500 dark:bg-pink-500/10' },
    delivered: { key: 'statusMap.delivered', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
    confirmed: { key: 'statusMap.confirmed', color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
    cancelled: { key: 'statusMap.cancelled', color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
    refunded: { key: 'statusMap.refunded', color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
  };
  const info = map[status];
  const label = info ? t(info.key) : status;
  const color = info?.color || 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  return <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${color}`}>{label}</span>;
}
