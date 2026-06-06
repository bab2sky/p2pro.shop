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
import { TrendingUp } from 'lucide-react';
import { getPlatformChart, type PlatformChartPoint } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function PlatformTrendChart({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['platformChart', from, to],
    queryFn: () => getPlatformChart({ from, to }),
  });

  if (isLoading)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-[350px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );

  const points: PlatformChartPoint[] = data?.data ?? [];
  if (points.length === 0)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
        <TrendingUp className="mx-auto mb-3 h-14 w-14 text-gray-200 dark:text-gray-700" />
        <p className="text-sm font-bold text-gray-400">데이터가 없습니다.</p>
      </div>
    );

  const chartData = points.map((p) => ({
    date: p.date,
    gmv: Number(p.gmv),
    commission: Number(p.commission),
    orders: p.orders,
  }));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">GMV &amp; 수수료 트렌드</h3>
      </div>
      <div className="p-5">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts Tooltip formatter signature 가 복잡한 union 이라 단순 cast 사용 */}
            <Tooltip formatter={((v: number) => fmt(v)) as any} />
            <Legend />
            <Area type="monotone" dataKey="gmv" name="GMV" stroke="#111827" fill="#f3f4f6" />
            <Area type="monotone" dataKey="commission" name="수수료" stroke="#ec4899" fill="#fce7f3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
