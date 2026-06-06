import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { ChevronLeft, ChevronRight, ScrollText, Filter } from 'lucide-react';

const ACTION_OPTIONS = [
  { value: '', label: '전체 작업' },
  { value: 'user_block', label: '사용자 차단' },
  { value: 'user_unblock', label: '사용자 차단 해제' },
  { value: 'seller_approved', label: '판매자 승인' },
  { value: 'seller_rejected', label: '판매자 거부' },
  { value: 'seller_suspended', label: '판매자 정지' },
  { value: 'settings_update', label: '시스템 설정 변경' },
];

export default function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', page, action, dateFrom, dateTo],
    queryFn: () =>
      adminApi
        .getAuditLogs({
          page,
          per_page: 20,
          action: action || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        })
        .then((r) => r.data),
  });

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">감사 로그</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400">
          <Filter className="h-4 w-4" />
          필터
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400">작업 유형</label>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              handleFilterChange();
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400">시작일</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              handleFilterChange();
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400">종료일</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              handleFilterChange();
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {(action || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setAction('');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            초기화
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">감사 추적 내역</h2>
        </div>

        {isLoading || !data ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    일시
                  </th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    관리자
                  </th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    작업
                  </th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    대상
                  </th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    상세
                  </th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    IP 주소
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                      {log.admin_name || log.admin_id.substring(0, 8)}
                    </td>
                    <td className="px-5 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-900 dark:text-gray-300">
                      <span className="text-gray-500">{log.target_type}</span>
                      {log.target_id && (
                        <span className="ml-1 font-mono text-xs text-gray-400">
                          {log.target_id.substring(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <ScrollText className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                      <p className="mt-3 text-sm font-bold text-gray-400 dark:text-gray-500">
                        감사 로그가 없습니다
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm font-bold text-gray-500 dark:text-gray-400">
            {page} / {data.pagination.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    user_block: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    user_unblock: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    seller_approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    seller_rejected: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    seller_suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    settings_update: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  const labelMap: Record<string, string> = {
    user_block: '사용자 차단',
    user_unblock: '차단 해제',
    seller_approved: '판매자 승인',
    seller_rejected: '판매자 거부',
    seller_suspended: '판매자 정지',
    settings_update: '설정 변경',
  };

  const color = colorMap[action] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  const label = labelMap[action] || action;

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${color}`}>
      {label}
    </span>
  );
}
