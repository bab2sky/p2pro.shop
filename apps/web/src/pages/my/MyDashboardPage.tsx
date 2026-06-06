import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle2, Truck, PackageCheck, ThumbsUp, Ticket, Heart, AlertCircle, ChevronRight, Users, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getDashboard } from '@/lib/api/mypage';
import { getProfile } from '@/lib/api/profile';
import { ORDER_STATUS_LABELS } from '@/constants/status-maps';

export default function MyDashboardPage() {
  const { t } = useTranslation();
  const [copiedTarget, setCopiedTarget] = useState<'link' | 'code' | null>(null);
  const statusCards = [
    { key: 'pending_payment' as const, label: t('mypage.status.pendingPayment', '결제대기'), icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
    { key: 'payment_verified' as const, label: t('mypage.status.paymentVerified', '결제확인'), icon: CheckCircle2, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
    { key: 'shipped' as const, label: t('mypage.status.shipped', '배송중'), icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { key: 'delivered' as const, label: t('mypage.status.delivered', '배송완료'), icon: PackageCheck, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { key: 'confirmed' as const, label: t('mypage.status.confirmed', '구매확정'), icon: ThumbsUp, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10' },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['my', 'dashboard'],
    queryFn: getDashboard,
  });

  const { data: profileRes } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfile().then((r) => r.data),
  });

  if (isLoading)
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: i === 0 ? 80 : 120 }} />
        ))}
      </div>
    );

  if (!data) return null;

  const hasPending = data.order_counts.pending_payment > 0;

  return (
    <div className="space-y-5" role="main" aria-label={t('mypage.ariaDashboard', '마이페이지 대시보드')}>
      {/* FR-06: Pending payment banner */}
      {hasPending && (
        <div className="flex items-center gap-3 rounded-2xl bg-orange-50 px-5 py-4 dark:bg-orange-500/10" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0 text-orange-500" />
          <p className="flex-1 text-sm font-medium text-orange-800 dark:text-orange-400">
            {t('mypage.pendingPayment', '결제 대기 주문')} <strong>{t('mypage.ordersUnit', { count: data.order_counts.pending_payment, defaultValue: '{{count}}건' })}</strong> — {t('mypage.pendingPaymentTail', '24시간 내 미결제 시 자동 취소')}
          </p>
          <Link
            to="/my/orders?status=pending_payment"
            className="shrink-0 rounded-full bg-orange-500 px-4 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-orange-600"
          >
            {t('mypage.payNow', '결제하기')}
          </Link>
        </div>
      )}

      {/* FR-15: User summary */}
      <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white dark:bg-white dark:text-gray-900">
            {(data.user.nickname || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">
                {t('mypage.userGreeting', { name: data.user.nickname, defaultValue: '{{name}}님' })}
              </h2>
              {data.user.is_udg_member && (
                <span className="rounded-full bg-pink-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  UDG
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
              {t('mypage.joinDate', '가입일')} {new Date(data.user.created_at).toLocaleDateString()} · {t('mypage.totalOrders', '총 주문')} {t('mypage.ordersUnit', { count: data.total_orders, defaultValue: '{{count}}건' })} · ₮ {Number(data.total_spent).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* FR-02: Order status cards */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {statusCards.map((card) => {
          const count = data.order_counts[card.key];
          const Icon = card.icon;
          return (
            <Link
              key={card.key}
              to={`/my/orders?status=${card.key}`}
              aria-label={`${card.label} ${count}건`}
              className={`flex flex-col items-center rounded-2xl ${card.bg} p-3 sm:p-4 transition-all hover:scale-[1.03] hover:shadow-md`}
            >
              <Icon className={`h-5 w-5 ${card.color}`} />
              <span className={`mt-1.5 text-xl font-bold sm:text-2xl ${card.color}`}>{count}</span>
              <span className="mt-0.5 text-[11px] font-medium text-gray-500 sm:text-xs dark:text-gray-400">{card.label}</span>
            </Link>
          );
        })}
      </div>

      {/* FR-03: Recent orders */}
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('mypage.recentOrders', '최근 주문')}</h3>
          <Link
            to="/my/orders"
            className="flex items-center gap-0.5 text-[13px] font-medium text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            {t('mypage.viewAll', '전체보기')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {data.recent_orders.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {t('mypage.noOrders', '주문 내역이 없습니다.')}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.recent_orders.map((order) => (
              <Link
                key={order.id}
                to={`/my/orders/${order.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                  {order.first_item_image ? (
                    <img src={order.first_item_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-400">No img</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {order.first_item_title || t('mypage.productPlaceholder', '상품')}
                    {order.item_count > 1 && t('mypage.additionalItems', { count: order.item_count - 1, defaultValue: ' 외 {{count}}건' })}
                  </p>
                  <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
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
                  <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                    ₮ {Number(order.total_amount).toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* FR-11, FR-12: Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/my/coupons"
          className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
              <Ticket className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('mypage.myCoupons', '보유 쿠폰')}</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">{data.coupon_count}<span className="text-sm font-medium text-gray-400">{t('mypage.couponsUnit', '장')}</span></span>
        </Link>
        <Link
          to="/my/wishlist"
          className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-500/10">
              <Heart className="h-4 w-4 text-pink-500" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('mypage.wishlistShort', '위시리스트')}</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">{data.wishlist_count}<span className="text-sm font-medium text-gray-400">{t('mypage.wishlistUnit', '개')}</span></span>
        </Link>
      </div>

      {/* Referral card */}
      {profileRes && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('mypage.myReferrals', '내 추천')}</span>
                <p className="truncate text-[12px] text-gray-400 dark:text-gray-500">
                  {`${window.location.origin}/register?ref=${profileRes.referral_code}`}
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-gray-500 dark:text-gray-400">
                  {t('mypage.referralCodeLabel', '코드')}: <span className="font-bold text-gray-900 dark:text-white">{profileRes.referral_code}</span>
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xl font-bold text-gray-900 dark:text-white">
              {profileRes.referral_count}<span className="text-sm font-medium text-gray-400">{t('mypage.referralsUnit', '명')}</span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(profileRes.referral_code);
                setCopiedTarget('code');
                toast.success(t('mypage.referralCodeCopied', '추천 코드가 복사되었습니다!'));
                setTimeout(() => setCopiedTarget((c) => (c === 'code' ? null : c)), 2000);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                copiedTarget === 'code'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
              title={t('mypage.referralCodeCopyTitle', '추천 코드 복사')}
            >
              {copiedTarget === 'code' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {t('mypage.referralCodeCopyButton', '코드 복사')}
            </button>
            <button
              onClick={async () => {
                const link = `${window.location.origin}/register?ref=${profileRes.referral_code}`;
                await navigator.clipboard.writeText(link);
                setCopiedTarget('link');
                toast.success(t('mypage.referralLinkCopied', '링크가 복사되었습니다!'));
                setTimeout(() => setCopiedTarget((c) => (c === 'link' ? null : c)), 2000);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                copiedTarget === 'link'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
              }`}
              title={t('mypage.referralCopyTitle', '추천 링크 복사')}
            >
              {copiedTarget === 'link' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {t('mypage.referralLinkCopyButton', '링크 복사')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
