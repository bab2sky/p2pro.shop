import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { getSellerProductProfits, type ProductProfit } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function ProductProfitTable({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sellerProductProfits', from, to],
    queryFn: () => getSellerProductProfits({ from, to }),
  });

  if (isLoading) return <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 300 }} />;

  const products: ProductProfit[] = data?.data ?? [];
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center py-16">
        <Package className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">상품별 수익 분석</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">#</th>
              <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">상품명</th>
              <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">원가</th>
              <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">평균판매가</th>
              <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">판매수량</th>
              <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">매출</th>
              <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">이익</th>
              <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">이익률</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {products.map((p, i) => (
              <tr key={p.product_id} className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-[12px] font-bold text-gray-400">{i + 1}</td>
                <td className="max-w-[200px] truncate px-4 py-3 font-bold text-gray-900 dark:text-white">{p.title}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(p.base_price)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(p.avg_selling_price)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{p.units_sold}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(p.revenue)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-500">{fmt(p.profit)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    Number(p.margin_pct) >= 20
                      ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                      : Number(p.margin_pct) >= 10
                        ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'
                        : 'bg-red-50 text-red-500 dark:bg-red-500/10'
                  }`}>
                    {fmt(p.margin_pct)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
