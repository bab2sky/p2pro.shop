import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { getSellerCommissions, type CommissionDetail } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function CommissionHistory({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['sellerCommissions', from, to, page],
    queryFn: () => getSellerCommissions({ from, to, page, per_page: perPage }),
  });

  if (isLoading) return <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 300 }} />;

  const items: CommissionDetail[] = data?.data ?? [];
  const totalPages = data?.pagination?.total_pages ?? 0;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-16">
        <Receipt className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">수수료 내역</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">주문번호</th>
                <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">주문일</th>
                <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">주문금액</th>
                <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">수수료율</th>
                <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">수수료</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((c) => (
                <tr key={c.order_id} className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-[12px] text-gray-500">{c.order_number}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-500">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{fmt(c.order_total)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(c.commission_rate)}%</td>
                  <td className="px-4 py-3 text-right font-bold text-pink-500">{fmt(c.commission_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
