import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminDisputes, type Dispute, type DisputeStatus } from '@/lib/api/disputes';
import {
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  DISPUTE_TYPE_LABELS,
} from '@/constants/status-maps';
import { ChevronLeft, ChevronRight, AlertTriangle, Eye } from 'lucide-react';

// Admin uses slightly different labels
const STATUS_LABELS: Record<string, string> = {
  ...DISPUTE_STATUS_LABELS,
  open: '신청됨',
  responded: '응답됨',
  under_review: '검토중',
};

const STATUS_COLORS = DISPUTE_STATUS_COLORS as Record<DisputeStatus, string>;
const TYPE_LABELS = DISPUTE_TYPE_LABELS;

const FILTER_TABS = [
  { value: '', label: '전체' },
  { value: 'open', label: '신청됨' },
  { value: 'responded', label: '응답됨' },
  { value: 'under_review', label: '검토중' },
  { value: 'resolved', label: '해결됨' },
  { value: 'closed', label: '종료' },
];

interface AdminDisputeTableProps {
  onSelect: (dispute: Dispute) => void;
}

export function AdminDisputeTable({ onSelect }: AdminDisputeTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['adminDisputes', statusFilter, page],
    queryFn: () =>
      getAdminDisputes({
        status: statusFilter || undefined,
        page,
      }),
  });

  const disputes: Dispute[] = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">분쟁 관리</h2>

      {/* Filter Tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-800">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`border-b-2 px-4 py-2.5 text-sm transition-colors ${
              statusFilter === tab.value
                ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-14" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="py-16 text-center">
          <AlertTriangle className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
          <p className="mt-3 text-sm font-bold text-gray-400 dark:text-gray-500">분쟁 내역이 없습니다</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">유형</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">신고자</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">피신고자</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">신청일</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">액션</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((dispute) => (
                  <tr
                    key={dispute.id}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => onSelect(dispute)}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-gray-300">
                      {dispute.order_id.slice(0, 8)}...
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {TYPE_LABELS[dispute.dispute_type] || dispute.dispute_type}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {dispute.complainant_id.slice(0, 8)}...
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {dispute.respondent_id.slice(0, 8)}...
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLORS[dispute.status]}`}>
                        {STATUS_LABELS[dispute.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(dispute.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(dispute);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm font-bold text-gray-500 dark:text-gray-400">
            {page} / {pagination.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            disabled={page >= pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
