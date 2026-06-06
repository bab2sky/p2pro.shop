import { useQuery } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { getCategoryProfits, type CategoryProfit } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function CategoryProfitTable({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['categoryProfits', from, to],
    queryFn: () => getCategoryProfits({ from, to }),
  });

  if (isLoading)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );

  const categories: CategoryProfit[] = data?.data ?? [];
  if (categories.length === 0)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
        <LayoutGrid className="mx-auto mb-3 h-14 w-14 text-gray-200 dark:text-gray-700" />
        <p className="text-sm font-bold text-gray-400">데이터가 없습니다.</p>
      </div>
    );

  const totalGmv = categories.reduce((sum, c) => sum + Number(c.gmv), 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">카테고리별 수익</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">카테고리</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">GMV</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">수수료</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">주문수</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">판매수량</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">GMV 비중</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const share = totalGmv > 0 ? (Number(c.gmv) / totalGmv * 100) : 0;
              return (
                <tr key={c.category_id} className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{c.category_name}</td>
                  <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(c.gmv)}</td>
                  <td className="px-5 py-3 text-right text-pink-500 font-bold">{fmt(c.commission)}</td>
                  <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{c.orders}</td>
                  <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{c.units_sold}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full bg-gray-900 dark:bg-white" style={{ width: `${Math.min(share, 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{fmt(share)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
