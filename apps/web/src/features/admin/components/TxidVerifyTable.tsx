import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { X, ChevronLeft, ChevronRight, FileSearch } from 'lucide-react';

export function TxidVerifyTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'txid', 'pending', page],
    queryFn: () => adminApi.getPendingTxids(page).then((r) => r.data),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      adminApi.verifyTxid(id, action, reason),
    onSuccess: () => {
      setRejectId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-10 w-48" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-14" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">TXID 검증</h1>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">검증 대기 목록</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">TXID</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</th>
                <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">금액</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">사유</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((txid) => (
                <tr key={txid.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-gray-300">{txid.order_number}</td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs text-gray-900 dark:text-gray-300" title={txid.txid}>
                      {txid.txid.substring(0, 10)}...{txid.txid.substring(txid.txid.length - 6)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-900 dark:text-gray-300">{txid.buyer_name}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-pink-500">${txid.total_amount}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      txid.verification_status === 'failed'
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {txid.verification_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {txid.failure_reason || '-'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => verifyMutation.mutate({ id: txid.id, action: 'approve' })}
                        disabled={verifyMutation.isPending}
                        className="rounded-full bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => setRejectId(txid.id)}
                        className="rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                      >
                        거부
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <FileSearch className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                    <p className="mt-3 text-sm font-bold text-gray-400 dark:text-gray-500">검증 대기 TXID가 없습니다</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm font-bold text-gray-500 dark:text-gray-400">{page} / {data.pagination.total_pages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">거부 사유 입력</h3>
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거부 사유를 입력해주세요..."
              className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="rounded-full bg-gray-100 px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => verifyMutation.mutate({ id: rejectId, action: 'reject', reason: rejectReason })}
                disabled={!rejectReason.trim() || verifyMutation.isPending}
                className="rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
              >
                거부
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
