import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { getWithdrawalHistory } from '@/lib/api/settlements';

const statusConfig: Record<string, { label: string; style: string; icon: typeof Clock }> = {
  pending: { label: '대기', style: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10', icon: Clock },
  approved: { label: '승인', style: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10', icon: CheckCircle },
  rejected: { label: '거절', style: 'bg-red-50 text-red-500 dark:bg-red-500/10', icon: XCircle },
};

export function WithdrawalTable() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['settlement', 'withdrawals', page],
    queryFn: () => getWithdrawalHistory({ page }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 60 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
        <ArrowDownCircle className="h-4 w-4" />
        출금 내역
      </h2>

      <div className="overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <th className="px-4 py-3 text-right text-[12px] font-bold text-gray-500">금액</th>
              <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">지갑</th>
              <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">네트워크</th>
              <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">신청일</th>
              <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">사유</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.data.map((w) => {
              const st = statusConfig[w.status] ?? { label: w.status, style: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: Clock };
              const Icon = st.icon;
              return (
                <tr key={w.id} className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">${w.amount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.style}`}>
                      <Icon className="h-3 w-3" />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-gray-500">
                    {w.wallet_address.length > 20
                      ? `${w.wallet_address.substring(0, 10)}...${w.wallet_address.substring(w.wallet_address.length - 6)}`
                      : w.wallet_address}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {w.network}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-400">
                    {w.requested_at ? new Date(w.requested_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-400">
                    {w.reject_reason || '-'}
                  </td>
                </tr>
              );
            })}
            {data.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <ArrowDownCircle className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-bold text-gray-900 dark:text-white">출금 내역이 없습니다.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.pagination.total_pages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: data.pagination.total_pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
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
