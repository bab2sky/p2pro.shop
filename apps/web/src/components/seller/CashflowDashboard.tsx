import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
  Clock,
} from 'lucide-react';
import { getSellerCashflow, type CashflowSummary, type CashflowPoint } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function CashflowDashboard({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sellerCashflow', from, to],
    queryFn: () => getSellerCashflow({ from, to }),
  });

  if (isLoading) return <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 400 }} />;

  const cashflow: CashflowSummary | undefined = data?.data;
  if (!cashflow) {
    return (
      <div className="flex flex-col items-center py-16">
        <Wallet className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">데이터가 없습니다.</p>
      </div>
    );
  }

  const chartData = (cashflow.chart ?? []).map((p: CashflowPoint) => ({
    date: p.date,
    inflow: Number(p.inflow),
    outflow: Number(p.outflow),
    balance: Number(p.balance),
  }));

  const cards = [
    { label: '현재 잔고', value: fmt(cashflow.current_balance), icon: Wallet, iconColor: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10', iconBg: 'bg-pink-100 dark:bg-pink-500/20', highlight: true },
    { label: '총 수입', value: fmt(cashflow.total_earned), icon: TrendingUp, iconColor: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', iconBg: 'bg-emerald-100 dark:bg-emerald-500/20' },
    { label: '총 출금', value: fmt(cashflow.total_withdrawn), icon: TrendingDown, iconColor: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', iconBg: 'bg-red-100 dark:bg-red-500/20' },
    { label: '출금 수수료', value: fmt(cashflow.total_fees), icon: Percent, iconColor: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', iconBg: 'bg-amber-100 dark:bg-amber-500/20' },
    { label: '정산 대기', value: fmt(cashflow.pending_settlements), icon: Clock, iconColor: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900', iconBg: 'bg-gray-100 dark:bg-gray-800' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-2xl p-4 text-center ${card.bg}`}>
            <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
            <p className={`text-xl font-bold ${card.highlight ? 'text-pink-500' : 'text-gray-900 dark:text-white'}`}>
              {card.value}
            </p>
            <p className="text-[12px] font-medium text-gray-400">{card.label}</p>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
          <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">캐시플로우 추이</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts Tooltip formatter union 타입 cast
                formatter={((v: number) => fmt(v)) as any}
                contentStyle={{
                  borderRadius: 16,
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="inflow" name="유입" stroke="#10b981" fill="#dcfce7" />
              <Area type="monotone" dataKey="outflow" name="유출" stroke="#ef4444" fill="#fee2e2" />
              <Area type="monotone" dataKey="balance" name="누적잔고" stroke="#111827" fill="#f3f4f6" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
