import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  X,
} from 'lucide-react';
import { sellerRefundApi, type RefundRequestInfo } from '@/lib/api/refunds';
import { confirmAction } from '@/lib/confirm';
import { REFUND_STATUS_LABELS, REFUND_REASON_LABELS } from '@/constants/status-maps';

const statusLabels: Record<string, string> = {
  ...REFUND_STATUS_LABELS,
  requested: '응답 대기',
  seller_approved: '승인함',
  seller_rejected: '거절함',
};

const statusStyles: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10',
  seller_approved: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10',
  seller_rejected: 'bg-red-50 text-red-500 dark:bg-red-500/10',
  admin_approved: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10',
  refunded: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const reasonLabels = REFUND_REASON_LABELS;

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none resize-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function SellerRefundsPage() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [modalRefund, setModalRefund] = useState<RefundRequestInfo | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const queryClient = useQueryClient();

  const statusFilter = tab === 'pending' ? 'requested' : undefined;

  const listQ = useQuery({
    queryKey: ['seller', 'refunds', page, statusFilter],
    queryFn: () => sellerRefundApi.list(page, 20, statusFilter),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof sellerRefundApi.respond>[1] }) =>
      sellerRefundApi.respond(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'refunds'] });
      setModalRefund(null);
      setRejectReason('');
    },
  });

  const refunds: RefundRequestInfo[] = listQ.data?.data?.data ?? [];
  const pagination = listQ.data?.data?.pagination;

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">환불 관리</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab('pending'); setPage(1); }}
          className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          대기 중
        </button>
        <button
          onClick={() => { setTab('all'); setPage(1); }}
          className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            tab === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          전체
        </button>
      </div>

      {/* List */}
      {refunds.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <RotateCcw className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {tab === 'pending' ? '대기 중인 환불 요청이 없습니다.' : '환불 요청이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {refunds.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-[12px] text-gray-400">{r.order_number}</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white">구매자: {r.buyer_name ?? '-'}</p>
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusStyles[r.status] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {r.status === 'requested' ? <Clock className="h-3 w-3" /> : r.status.includes('approved') || r.status === 'refunded' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {statusLabels[r.status] ?? r.status}
                </span>
              </div>
              <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                <p>사유: <span className="text-gray-900 dark:text-gray-200">{reasonLabels[r.reason_code] ?? r.reason_code}</span></p>
                <p>상세: <span className="text-gray-900 dark:text-gray-200">{r.reason}</span></p>
                <div className="flex items-center gap-4">
                  <p>주문 금액: <span className="font-bold text-gray-900 dark:text-white">₮ {r.order_total}</span></p>
                  <p>요청일: <span className="text-gray-900 dark:text-gray-200">{formatDate(r.created_at)}</span></p>
                </div>
                {r.refund_amount && (
                  <p className="font-bold text-emerald-500">환불 금액: ₮ {r.refund_amount}</p>
                )}
              </div>
              {r.status === 'requested' && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={async () => {
                      if (await confirmAction('환불을 승인하시겠습니까?')) {
                        respondMutation.mutate({ id: r.id, body: { action: 'approve' } });
                      }
                    }}
                    disabled={respondMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    승인
                  </button>
                  <button
                    onClick={() => { setModalRefund(r); setRejectReason(''); }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-red-50 py-2.5 text-[13px] font-bold text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    거절
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                p === page ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {modalRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModalRefund(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">환불 거절</h2>
              <button onClick={() => setModalRefund(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-[13px] text-gray-500 dark:text-gray-400">주문 #{modalRefund.order_number}</p>
            <textarea
              placeholder="거절 사유를 입력해주세요"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className={inputClass}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setModalRefund(null)}
                className="flex-1 rounded-full bg-gray-100 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={() => {
                  respondMutation.mutate({
                    id: modalRefund.id,
                    body: { action: 'reject', reason: rejectReason || undefined },
                  });
                }}
                disabled={respondMutation.isPending}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                거절
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
