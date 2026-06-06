import { useQuery } from '@tanstack/react-query';
import { getActiveTimeDeals, type TimeDeal } from '@/lib/api/analytics';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Clock, Zap, ShoppingBag } from 'lucide-react';

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('종료');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm font-bold text-red-600 dark:text-red-400">
      <Clock className="h-3.5 w-3.5" />
      {timeLeft}
    </span>
  );
}

function DealCard({ deal }: { deal: TimeDeal }) {
  const dealPrice = parseFloat(deal.deal_price);
  const origPrice = parseFloat(deal.original_price);
  const discount = origPrice > 0 ? Math.round(((origPrice - dealPrice) / origPrice) * 100) : 0;
  const soldRatio = deal.max_quantity ? Math.min((deal.sold_quantity / deal.max_quantity) * 100, 100) : 0;

  return (
    <Link
      to={`/products/${deal.product_id}`}
      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
        {deal.image ? (
          <img
            src={deal.image}
            alt={deal.title || deal.product_title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          </div>
        )}
        {/* Discount badge */}
        <div className="absolute left-3 top-3 rounded-lg bg-red-500 px-2.5 py-1 text-sm font-bold text-white shadow">
          -{discount}%
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="mb-2 line-clamp-2 text-sm font-bold text-gray-900 dark:text-white">
          {deal.title || deal.product_title}
        </h3>

        {/* Price */}
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-red-600 dark:text-red-400">
            {dealPrice.toLocaleString()} USDT
          </span>
          <span className="text-sm text-gray-400 line-through">
            {origPrice.toLocaleString()}
          </span>
        </div>

        {/* Timer */}
        <div className="mb-3">
          <CountdownTimer endsAt={deal.ends_at} />
        </div>

        {/* Stock progress */}
        {deal.max_quantity && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{deal.sold_quantity}개 판매</span>
              <span>한정 {deal.max_quantity}개</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-all"
                style={{ width: `${soldRatio}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export function TimeDealsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['active-time-deals'],
    queryFn: getActiveTimeDeals,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const deals = data?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">타임딜</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">한정 수량, 한정 시간 특가 상품!</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">현재 진행 중인 타임딜이 없습니다</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            새로운 타임딜이 시작되면 여기에 표시됩니다.
          </p>
          <Link
            to="/products"
            className="mt-6 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            전체 상품 보기
          </Link>
        </div>
      )}

      {/* Deals Grid */}
      {deals.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}

export default TimeDealsPage;
