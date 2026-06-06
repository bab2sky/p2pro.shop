import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { getSellerContributions, type SellerContribution } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function SellerContributionTable({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sellerContributions', from, to],
    queryFn: () => getSellerContributions({ from, to }),
  });

  if (isLoading)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );

  const sellers: SellerContribution[] = data?.data ?? [];
  if (sellers.length === 0)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
        <Store className="mx-auto mb-3 h-14 w-14 text-gray-200 dark:text-gray-700" />
        <p className="text-sm font-bold text-gray-400">데이터가 없습니다.</p>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">판매자별 기여도</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">순위</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">GMV</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">수수료</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">주문수</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">환불액</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">순기여</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((s, i) => (
              <tr key={s.seller_id} className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                <td className="px-5 py-3">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    i < 3 ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{s.business_name ?? '-'}</td>
                <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(s.gmv)}</td>
                <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(s.commission)}</td>
                <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{s.orders}</td>
                <td className="px-5 py-3 text-right text-red-500">{fmt(s.refunds)}</td>
                <td className="px-5 py-3 text-right font-bold text-pink-500">{fmt(s.net_contribution)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
