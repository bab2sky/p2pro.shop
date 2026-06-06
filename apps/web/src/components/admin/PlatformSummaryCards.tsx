import { TrendingUp, Wallet, DollarSign, BarChart3 } from 'lucide-react';
import { type PlatformSummary } from '@/lib/api/profit';
import { fmt } from './profitUtils';
import ChangeIndicator from './ChangeIndicator';

export default function PlatformSummaryCards({ data }: { data: PlatformSummary }) {
  const cards = [
    { title: 'GMV', value: data.gmv, change: data.comparison.gmv_change_pct, icon: <BarChart3 className="h-4 w-4 text-pink-500" />, iconBg: 'bg-pink-50 dark:bg-pink-500/10' },
    { title: '수수료 수입', value: data.total_commission, change: data.comparison.commission_change_pct, icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, iconBg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { title: '출금 수수료', value: data.total_withdrawal_fees, icon: <Wallet className="h-4 w-4 text-purple-500" />, iconBg: 'bg-purple-50 dark:bg-purple-500/10' },
    { title: '플랫폼 순수입', value: data.net_platform_profit, icon: <DollarSign className="h-4 w-4 text-amber-500" />, iconBg: 'bg-amber-50 dark:bg-amber-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.title} className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${c.iconBg}`}>
              {c.icon}
            </div>
            <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{c.title}</span>
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{fmt(c.value)}</p>
          {c.change && <div className="mt-1"><ChangeIndicator value={c.change} /></div>}
        </div>
      ))}
    </div>
  );
}
