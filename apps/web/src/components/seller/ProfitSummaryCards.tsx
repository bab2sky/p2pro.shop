import {
  TrendingUp,
  Coins,
  PiggyBank,
  Percent,
} from 'lucide-react';
import type { ProfitSummary } from '@/lib/api/profit';
import { fmt } from './profitUtils';
import ChangeIndicator from './ChangeIndicator';

export default function ProfitSummaryCards({ data }: { data: ProfitSummary }) {
  const cards = [
    { title: '총매출', value: fmt(data.gross_sales), change: data.comparison.sales_change_pct, icon: TrendingUp, iconColor: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900', iconBg: 'bg-gray-100 dark:bg-gray-800' },
    { title: '마진 수입', value: fmt(data.margin_income), icon: Coins, iconColor: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', iconBg: 'bg-amber-100 dark:bg-amber-500/20' },
    { title: '순이익', value: fmt(data.net_profit), change: data.comparison.profit_change_pct, icon: PiggyBank, iconColor: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', highlight: true },
    { title: '이익률', value: `${fmt(data.profit_margin)}%`, icon: Percent, iconColor: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10', iconBg: 'bg-pink-100 dark:bg-pink-500/20' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.title} className={`rounded-2xl p-4 text-center ${c.bg}`}>
          <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${c.iconBg}`}>
            <c.icon className={`h-4 w-4 ${c.iconColor}`} />
          </div>
          <p className={`text-2xl font-bold ${c.highlight ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
            {c.value}
          </p>
          {c.change && <ChangeIndicator value={c.change} />}
          <p className="mt-0.5 text-[12px] font-medium text-gray-400">{c.title}</p>
        </div>
      ))}
    </div>
  );
}
