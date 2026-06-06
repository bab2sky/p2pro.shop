import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getSellerProfitChart, type ProfitChartPoint } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function ProfitChart({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sellerProfitChart', from, to],
    queryFn: () => getSellerProfitChart({ from, to }),
  });

  if (isLoading) {
    return <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 400 }} />;
  }

  const points: ProfitChartPoint[] = data?.data ?? [];
  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center py-16">
        <TrendingUp className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">데이터가 없습니다.</p>
      </div>
    );
  }

  const chartData = points.map((p) => ({
    date: p.date,
    gross_sales: Number(p.gross_sales),
    net_profit: Number(p.net_profit),
    orders: p.orders,
  }));

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
      <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">수익 추이</h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
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
          <Line type="monotone" dataKey="gross_sales" name="총매출" stroke="#111827" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="net_profit" name="순이익" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
