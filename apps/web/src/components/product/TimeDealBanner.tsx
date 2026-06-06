import { useQuery } from '@tanstack/react-query';
import { getActiveTimeDeals } from '@/lib/api/analytics';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

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

  return <span className="font-mono text-red-600 font-bold">{timeLeft}</span>;
}

export default function TimeDealBanner() {
  const { data } = useQuery({
    queryKey: ['active-time-deals'],
    queryFn: getActiveTimeDeals,
    staleTime: 30_000,
  });

  const deals = data?.data ?? [];
  if (deals.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg font-bold">⚡ 타임딜</span>
        <span className="text-sm opacity-80">한정 수량 특가!</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {deals.slice(0, 6).map((deal) => {
          const dealPrice = parseFloat(deal.deal_price);
          const origPrice = parseFloat(deal.original_price);
          const discount = origPrice > 0 ? Math.round(((origPrice - dealPrice) / origPrice) * 100) : 0;

          return (
            <Link
              key={deal.id}
              to={`/products/${deal.product_id}`}
              className="flex-shrink-0 w-40 bg-white/10 backdrop-blur rounded-lg p-3 hover:bg-white/20 transition"
            >
              {deal.image && (
                <img src={deal.image} alt="" className="w-full h-24 object-cover rounded mb-2" />
              )}
              <p className="text-sm font-medium truncate">{deal.title || deal.product_title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-red-200 line-through text-xs">{origPrice.toLocaleString()}</span>
                <span className="font-bold">{dealPrice.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="bg-red-700 px-1.5 py-0.5 rounded">-{discount}%</span>
                <CountdownTimer endsAt={deal.ends_at} />
              </div>
              {deal.max_quantity && (
                <div className="mt-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${Math.min((deal.sold_quantity / deal.max_quantity) * 100, 100)}%` }}
                  />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
