import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { getPlatformPnL, type MonthlyPlatformPnL } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function MonthlyPnLTable({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['platformPnL', from, to],
    queryFn: () => getPlatformPnL({ from, to }),
  });

  if (isLoading)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );

  const rows: MonthlyPlatformPnL[] = data?.data ?? [];
  if (rows.length === 0)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
        <CalendarDays className="mx-auto mb-3 h-14 w-14 text-gray-200 dark:text-gray-700" />
        <p className="text-sm font-bold text-gray-400">데이터가 없습니다.</p>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">월별 손익</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">월</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">GMV</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">수수료</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">출금 수수료</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">환불</th>
              <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">순수입</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{r.month}</td>
                <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.gmv)}</td>
                <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.commission)}</td>
                <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.withdrawal_fees)}</td>
                <td className="px-5 py-3 text-right text-red-500">{fmt(r.refunds)}</td>
                <td className="px-5 py-3 text-right font-bold text-pink-500">{fmt(r.net_profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
