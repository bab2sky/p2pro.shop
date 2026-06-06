import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';

export function AdminLogTable() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'logs', page],
    queryFn: () => adminApi.getLogs(page).then((r) => r.data),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-10 w-48" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-14" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">활동 로그</h1>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">관리자 활동 내역</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">작업</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">대상 유형</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">대상 ID</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상세</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">IP 주소</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">일시</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-900 dark:text-gray-300">{log.target_type}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {log.target_id.substring(0, 8)}...
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                    {log.details ? JSON.stringify(log.details) : '-'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {log.ip_address || '-'}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <ScrollText className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                    <p className="mt-3 text-sm font-bold text-gray-400 dark:text-gray-500">활동 로그가 없습니다</p>
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
    </div>
  );
}
