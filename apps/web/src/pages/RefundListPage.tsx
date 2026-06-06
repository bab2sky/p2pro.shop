import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, ChevronRight } from 'lucide-react';
import { refundApi, type RefundRequestInfo } from '@/lib/api/refunds';
import {
  REFUND_STATUS_LABELS as statusLabels,
  REFUND_STATUS_COLORS as statusColors,
  REFUND_REASON_LABELS as reasonLabels,
} from '@/constants/status-maps';

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function RefundListPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my', 'refunds', page],
    queryFn: () => refundApi.list(page, 20),
  });

  const refunds: RefundRequestInfo[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;

  if (isLoading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
        ))}
      </div>
    );

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">환불 내역</h1>

      {refunds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RotateCcw className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">환불 요청 내역이 없습니다.</p>
          <button
            onClick={() => navigate('/my/orders')}
            className="mt-3 rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            주문 내역으로 이동
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {refunds.map((r) => (
            <div
              key={r.id}
              className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              onClick={() => navigate(`/refunds/${r.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-mono text-gray-400 dark:text-gray-500">{r.order_number}</p>
                  <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                    {reasonLabels[r.reason_code] ?? r.reason_code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColors[r.status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {statusLabels[r.status] ?? r.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px] text-gray-500 dark:text-gray-400">
                <span>주문 금액: ₮ {r.order_total}</span>
                <span>{formatDate(r.created_at)}</span>
              </div>
              {r.refund_amount && (
                <p className="mt-1 text-[13px] font-bold text-emerald-500">환불 금액: ₮ {r.refund_amount}</p>
              )}
              {r.status === 'seller_rejected' && (
                <p className="mt-1 text-[12px] text-red-500">
                  거절 사유: {r.seller_reason ?? '사유 없음'} — 분쟁을 제기할 수 있습니다.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-6 flex justify-center gap-1.5">
          {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`h-8 min-w-[2rem] rounded-full text-[13px] font-bold transition-all ${
                p === page
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
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
