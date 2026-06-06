import { useQuery } from '@tanstack/react-query';
import { Eye, CalendarDays, TrendingUp, ShoppingCart, Target } from 'lucide-react';
import { getProductViewStats, type ProductViewStats } from '@/lib/api/bulk';

interface ProductStatsTableProps {
  productId: string;
}

export function ProductStatsTable({ productId }: ProductStatsTableProps) {
  const { data, isLoading } = useQuery<{ data: ProductViewStats }>({
    queryKey: ['product-stats', productId],
    queryFn: () => getProductViewStats(productId),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  const stats = data?.data;
  if (!stats) return null;

  const rows = [
    { icon: Eye, label: '총 조회수', value: stats.total_views.toLocaleString() },
    { icon: CalendarDays, label: '오늘 조회수', value: stats.today_views.toLocaleString() },
    { icon: TrendingUp, label: '주간 조회수', value: stats.weekly_views.toLocaleString() },
    { icon: ShoppingCart, label: '주문 수', value: stats.order_count.toLocaleString() },
    { icon: Target, label: '전환율', value: `${stats.conversion_rate}%`, highlight: true },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500">항목</th>
            <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500">수치</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <tr key={row.label} className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800">
              <td className="px-5 py-3">
                <span className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                  <row.icon className="h-3.5 w-3.5 text-gray-400" />
                  {row.label}
                </span>
              </td>
              <td className={`px-5 py-3 text-right font-mono text-[13px] font-bold ${row.highlight ? 'text-pink-500' : 'text-gray-900 dark:text-white'}`}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProductStatsTable;
