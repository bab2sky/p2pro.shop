import { useQuery } from '@tanstack/react-query';
import {
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { getSellerRefundLosses, type RefundSummary } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function RefundLossReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sellerRefundLosses', from, to],
    queryFn: () => getSellerRefundLosses({ from, to }),
  });

  if (isLoading) return <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 300 }} />;

  const summary: RefundSummary | undefined = data?.data;
  if (!summary) {
    return (
      <div className="flex flex-col items-center py-16">
        <RotateCcw className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-900">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
            <RotateCcw className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_refunds}건</p>
          <p className="text-[12px] font-medium text-gray-400">총 환불 건수</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-4 text-center dark:bg-red-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{fmt(summary.total_amount)} USDT</p>
          <p className="text-[12px] font-medium text-gray-400">총 환불 금액</p>
        </div>
      </div>

      {summary.items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">환불 상세 내역</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">환불일</th>
                  <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">환불금액</th>
                  <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary.items.map((item) => (
                  <tr key={item.refund_id} className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-[12px] text-gray-500">{new Date(item.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">{fmt(item.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.reason ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-12">
          <RotateCcw className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">환불 내역이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
