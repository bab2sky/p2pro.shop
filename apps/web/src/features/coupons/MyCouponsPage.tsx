import { useState } from 'react';
import { toast } from 'sonner';
import { Ticket } from 'lucide-react';
import { useCoupons, useClaimCoupon, type UserCoupon } from './useCoupons';
import { extractApiError } from '@/lib/api-error';

type TabStatus = 'available' | 'used' | 'expired';

export function MyCouponsPage() {
  const [tab, setTab] = useState<TabStatus>('available');
  const [code, setCode] = useState('');
  const { data: coupons, isLoading } = useCoupons(tab);
  const claimMutation = useClaimCoupon();

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      await claimMutation.mutateAsync(code.trim());
      setCode('');
      toast.success('쿠폰이 등록되었습니다!');
    } catch (err: unknown) {
      toast.error(extractApiError(err));
    }
  };

  const tabs: { key: TabStatus; label: string }[] = [
    { key: 'available', label: '사용 가능' },
    { key: 'used', label: '사용 완료' },
    { key: 'expired', label: '만료' },
  ];

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">내 쿠폰</h1>

      {/* Coupon code input */}
      <form onSubmit={handleClaim} className="mb-5 flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="쿠폰 코드 입력"
          className="flex-1 rounded-xl bg-gray-50 px-4 py-2.5 text-[13px] font-medium text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={claimMutation.isPending}
          className="rounded-full bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          등록
        </button>
      </form>

      {/* Tab navigation */}
      <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition-all ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Coupon list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
          ))}
        </div>
      ) : !coupons?.length ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Ticket className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">쿠폰이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {coupons.map((c: UserCoupon) => (
            <div
              key={c.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{c.coupon.name}</h3>
                  <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                    {c.coupon.discount_type === 'fixed'
                      ? `${c.coupon.discount_value} USDT 할인`
                      : `${c.coupon.discount_value}% 할인`}
                    {(c.coupon?.min_order_amount ?? 0) > 0 && ` (${c.coupon.min_order_amount} USDT 이상)`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                  ~{new Date(c.expires_at).toLocaleDateString('ko')}
                </span>
              </div>
              {c.coupon.discount_type === 'fixed' ? (
                <div className="mt-2">
                  <span className="text-xl font-bold text-pink-500">{c.coupon.discount_value}</span>
                  <span className="ml-1 text-sm font-medium text-pink-400">USDT</span>
                </div>
              ) : (
                <div className="mt-2">
                  <span className="text-xl font-bold text-pink-500">{c.coupon.discount_value}%</span>
                  <span className="ml-1 text-sm font-medium text-pink-400">할인</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyCouponsPage;
