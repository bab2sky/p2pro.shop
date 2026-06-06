import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Percent,
  CheckCircle,
  Wallet,
  Clock,
} from 'lucide-react';
import { getSettlementSummary } from '@/lib/api/settlements';

export function SettlementSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['settlement', 'summary'],
    queryFn: () => getSettlementSummary().then((r) => r.data),
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 100 }} />
        ))}
      </div>
    );
  }

  const cards = [
    { label: '총 매출', value: `$${data.total_sales}`, icon: TrendingUp, iconColor: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900', iconBg: 'bg-gray-100 dark:bg-gray-800' },
    { label: '수수료', value: `$${data.total_commission}`, sub: `(${(parseFloat(data.commission_rate) * 100).toFixed(1)}%)`, icon: Percent, iconColor: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', iconBg: 'bg-amber-100 dark:bg-amber-500/20' },
    { label: '출금 완료', value: `$${data.total_settled}`, icon: CheckCircle, iconColor: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', iconBg: 'bg-emerald-100 dark:bg-emerald-500/20' },
    { label: '출금 가능', value: `$${data.available_amount}`, icon: Wallet, iconColor: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10', iconBg: 'bg-pink-100 dark:bg-pink-500/20', highlight: true },
    { label: '출금 대기', value: `$${data.pending_withdrawal}`, icon: Clock, iconColor: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900', iconBg: 'bg-gray-100 dark:bg-gray-800' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-2xl p-4 text-center ${card.bg}`}>
          <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}>
            <card.icon className={`h-4 w-4 ${card.iconColor}`} />
          </div>
          <p className={`text-2xl font-bold ${card.highlight ? 'text-pink-500' : 'text-gray-900 dark:text-white'}`}>
            {card.value}
          </p>
          {card.sub && <p className="text-[12px] text-gray-400">{card.sub}</p>}
          <p className="text-[12px] font-medium text-gray-400">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
