import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { Mail, ChevronLeft, ChevronRight } from 'lucide-react';

export function AdminEmailLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-email-logs', page],
    queryFn: async () => {
      const res = await adminApi.getEmailLogs(page, 20);
      return res.data;
    },
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    sending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    sent: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">이메일 발송 로그</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">수신자</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">템플릿</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">제목</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">발송일</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((log: { id: string; email_to: string; template_key: string; subject: string; status: string; sent_at: string | null }) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 text-sm text-gray-900 dark:text-white">{log.email_to}</td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">{log.template_key}</td>
                  <td className="px-5 py-3 text-sm truncate max-w-xs text-gray-600 dark:text-gray-300">{log.subject}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColors[log.status] || 'bg-gray-100 text-gray-600'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Mail className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                    <p className="mt-3 font-bold text-gray-400">이메일 발송 로그가 없습니다.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminEmailLogsPage;
