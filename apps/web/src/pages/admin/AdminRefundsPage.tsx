import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminRefundApi, type RefundRequestInfo, type RefundStats } from '@/lib/api/refunds';
import { REFUND_STATUS_COLORS as statusColors, REFUND_REASON_LABELS as reasonLabels } from '@/constants/status-maps';
import { RotateCcw, ChevronLeft, ChevronRight, X, ImageIcon, Inbox, Clock, CheckCircle2, XCircle, BarChart3, DollarSign } from 'lucide-react';

// Admin uses slightly different labels for refund statuses
const statusLabels: Record<string, string> = {
  requested: '판매자 대기',
  seller_approved: '승인 대기',
  seller_rejected: '판매자 거절',
  admin_processing: '처리 중',
  admin_completed: '환불 완료',
  admin_rejected: '관리자 거절',
};

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Filter = '' | 'requested' | 'seller_approved' | 'seller_rejected' | 'admin_completed' | 'admin_rejected';

export default function AdminRefundsPage() {
  const [filter, setFilter] = useState<Filter>('');
  const [page, setPage] = useState(1);
  const [modalRefund, setModalRefund] = useState<RefundRequestInfo | null>(null);
  const [processType, setProcessType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const queryClient = useQueryClient();

  const statsQ = useQuery({
    queryKey: ['admin', 'refunds', 'stats'],
    queryFn: () => adminRefundApi.stats(),
  });

  const listQ = useQuery({
    queryKey: ['admin', 'refunds', 'list', page, filter],
    queryFn: () => adminRefundApi.list(page, 20, filter || undefined),
  });

  const processMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminRefundApi.process>[1] }) =>
      adminRefundApi.process(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
      setModalRefund(null);
      resetModal();
    },
  });

  const stats: RefundStats | undefined = statsQ.data?.data?.data;
  const refunds: RefundRequestInfo[] = listQ.data?.data?.data ?? [];
  const pagination = listQ.data?.data?.pagination;

  function resetModal() {
    setProcessType('full');
    setPartialAmount('');
    setAdminNote('');
    setRejectNote('');
  }

  function handleApprove() {
    if (!modalRefund) return;
    const body: Parameters<typeof adminRefundApi.process>[1] = {
      action: 'approve',
      refund_type: processType,
      note: adminNote || undefined,
    };
    if (processType === 'partial') {
      const amt = parseFloat(partialAmount);
      if (isNaN(amt) || amt <= 0) { toast.error('환불 금액을 입력해주세요.'); return; }
      body.refund_amount = amt;
    }
    processMutation.mutate({ id: modalRefund.id, body });
  }

  function handleReject() {
    if (!modalRefund) return;
    processMutation.mutate({
      id: modalRefund.id,
      body: { action: 'reject', note: rejectNote || '관리자 거절' },
    });
  }

  const filters: { value: Filter; label: string }[] = [
    { value: '', label: '전체' },
    { value: 'requested', label: '판매자 대기' },
    { value: 'seller_approved', label: '승인 대기' },
    { value: 'seller_rejected', label: '판매자 거절' },
    { value: 'admin_completed', label: '환불 완료' },
    { value: 'admin_rejected', label: '관리자 거절' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">환불 관리</h1>

      {/* Stats Cards */}
      {statsQ.isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <StatCard label="총 요청" value={stats.total_requested} icon={<Inbox className="h-4 w-4 text-gray-600" />} iconBg="bg-gray-100" />
          <StatCard label="판매자 대기" value={stats.pending_seller} highlight icon={<Clock className="h-4 w-4 text-orange-600" />} iconBg="bg-orange-50" />
          <StatCard label="판매자 승인" value={stats.seller_approved} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} iconBg="bg-green-50" />
          <StatCard label="처리 대기" value={stats.admin_pending} highlight icon={<BarChart3 className="h-4 w-4 text-orange-600" />} iconBg="bg-orange-50" />
          <StatCard label="완료" value={stats.completed} icon={<CheckCircle2 className="h-4 w-4 text-gray-600" />} iconBg="bg-gray-100" />
          <StatCard label="거절" value={stats.rejected} icon={<XCircle className="h-4 w-4 text-red-600" />} iconBg="bg-red-50" />
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50">
                <DollarSign className="h-4 w-4 text-pink-500" />
              </div>
              <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">총 환불 금액</p>
            </div>
            <p className="mt-2 text-lg font-bold text-pink-500">
              ₮ {Number(stats.total_refunded_amount).toLocaleString()}
            </p>
          </div>
        </div>
      )}
      {statsQ.isError && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-red-600 dark:border-gray-800 dark:bg-gray-900">
          통계를 불러올 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${
              filter === f.value
                ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">주문금액</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">사유</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">환불금액</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">요청일</th>
              <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">액션</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-white">{r.order_number}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{r.buyer_name ?? '-'}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{r.seller_name ?? '-'}</td>
                <td className="px-5 py-3 font-bold text-pink-500">₮ {r.order_total}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{reasonLabels[r.reason_code] ?? r.reason_code}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColors[r.status] ?? 'bg-gray-100'}`}>
                    {statusLabels[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {r.refund_amount ? <span className="font-bold text-pink-500">₮ {r.refund_amount}</span> : '-'}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{formatDate(r.created_at)}</td>
                <td className="px-5 py-3">
                  {(r.status === 'seller_approved' || r.status === 'admin_processing') && (
                    <button
                      onClick={() => { setModalRefund(r); resetModal(); }}
                      className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      처리
                    </button>
                  )}
                  {r.status === 'admin_completed' && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-700">완료</span>
                  )}
                </td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center">
                  <RotateCcw className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                  <p className="mt-3 font-bold text-gray-400">환불 요청이 없습니다.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                p === page
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Process Modal */}
      {modalRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModalRefund(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">환불 처리</h2>
              <button onClick={() => setModalRefund(null)} className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <dl className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <dt className="text-[12px] font-bold text-gray-500 dark:text-gray-400">주문번호</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{modalRefund.order_number}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[12px] font-bold text-gray-500 dark:text-gray-400">주문 금액</dt>
                <dd className="font-bold text-pink-500">₮ {modalRefund.order_total}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[12px] font-bold text-gray-500 dark:text-gray-400">환불 사유</dt>
                <dd className="text-gray-900 dark:text-white">{reasonLabels[modalRefund.reason_code] ?? modalRefund.reason_code}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-1">상세 사유</dt>
                <dd className="rounded-xl bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{modalRefund.reason}</dd>
              </div>
              {modalRefund.evidence_images && modalRefund.evidence_images.length > 0 && (
                <div>
                  <dt className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" />
                    증거 이미지 ({modalRefund.evidence_images.length}장)
                  </dt>
                  <dd className="flex gap-2">
                    {modalRefund.evidence_images.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gray-900 underline dark:text-white">
                        이미지 {i + 1}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            <div className="border-t border-gray-100 pt-4 space-y-3 dark:border-gray-800">
              <p className="text-sm font-bold text-gray-900 dark:text-white">환불 승인</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    checked={processType === 'full'}
                    onChange={() => setProcessType('full')}
                    className="text-gray-900"
                  />
                  전액 환불 (<span className="font-bold text-pink-500">₮ {modalRefund.order_total}</span>)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    checked={processType === 'partial'}
                    onChange={() => setProcessType('partial')}
                    className="text-gray-900"
                  />
                  부분 환불
                </label>
                {processType === 'partial' && (
                  <input
                    type="number"
                    step="0.01"
                    placeholder="환불 금액 (USDT)"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                )}
              </div>
              <textarea
                placeholder="관리자 메모 (선택)"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <button
                onClick={handleApprove}
                disabled={processMutation.isPending}
                className="w-full rounded-full bg-gray-900 py-2.5 font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                {processMutation.isPending ? '처리 중...' : '환불 승인'}
              </button>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4 space-y-3 dark:border-gray-800">
              <p className="text-sm font-bold text-red-600">환불 거절</p>
              <input
                type="text"
                placeholder="거절 사유"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <button
                onClick={handleReject}
                disabled={processMutation.isPending}
                className="w-full rounded-full border-2 border-gray-200 py-2 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                거절
              </button>
            </div>

            {processMutation.isError && (
              <p className="mt-3 text-center text-xs text-red-500">
                처리 중 오류가 발생했습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight, icon, iconBg }: { label: string; value: number; highlight?: boolean; icon?: React.ReactNode; iconBg?: string }) {
  return (
    <div className={`rounded-2xl bg-gray-50 p-4 dark:bg-gray-900 ${highlight ? 'ring-2 ring-gray-900/10 dark:ring-white/10' : ''}`}>
      <div className="flex items-center gap-2">
        {icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg || 'bg-gray-100'}`}>
            {icon}
          </div>
        )}
        <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
