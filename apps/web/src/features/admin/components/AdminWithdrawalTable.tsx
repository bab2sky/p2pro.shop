import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminWithdrawals, getWithdrawalStats, processWithdrawal } from '@/lib/api/settlements';
import type { WithdrawalRequest, WithdrawalStats } from '@/lib/api/settlements';
import { ChevronLeft, ChevronRight, X, Wallet, Eye, Check, Ban, CircleOff, CreditCard } from 'lucide-react';

type ModalType = 'detail' | 'reject' | 'cancel' | 'complete' | null;

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  approved: '승인',
  completed: '완료',
  rejected: '거부',
  cancelled: '취소',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
  approved: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  completed: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

export function AdminWithdrawalTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [reason, setReason] = useState('');
  const [txid, setTxid] = useState('');
  const [memo, setMemo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'withdrawals', page, statusFilter],
    queryFn: () => getAdminWithdrawals({ page, per_page: 20, status: statusFilter || undefined }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin', 'withdrawal-stats'],
    queryFn: () => getWithdrawalStats(),
  });

  const stats: WithdrawalStats | null = statsData?.data ?? null;

  const mutation = useMutation({
    mutationFn: ({ id, action, reason, txid, memo }: { id: string; action: string; reason?: string; txid?: string; memo?: string }) =>
      processWithdrawal(id, { action, reason, txid, memo }),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawal-stats'] });
    },
  });

  const openModal = (type: ModalType, w: WithdrawalRequest) => {
    setSelectedWithdrawal(w);
    setModalType(type);
    setReason('');
    setTxid('');
    setMemo('');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedWithdrawal(null);
    setReason('');
    setTxid('');
    setMemo('');
  };

  const formatAmount = (amount: string | null) => {
    if (!amount) return '-';
    const num = parseFloat(amount);
    return isNaN(num) ? amount : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">출금 관리</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="대기 중" count={stats.total_pending} amount={formatAmount(stats.pending_amount)} />
          <StatCard label="승인됨" count={stats.total_approved} amount={formatAmount(stats.approved_amount)} />
          <StatCard label="출금 완료" count={stats.total_completed} amount={formatAmount(stats.completed_amount)} />
          <StatCard label="오늘 출금" count={null} amount={formatAmount(stats.today_completed_amount)} />
          <StatCard label="이번 달 출금" count={null} amount={formatAmount(stats.month_completed_amount)} />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0 border-b border-gray-200 dark:border-gray-800">
          {[
            { value: '', label: '전체' },
            { value: 'pending', label: `대기 (${stats?.total_pending ?? 0})` },
            { value: 'approved', label: `승인 (${stats?.total_approved ?? 0})` },
            { value: 'completed', label: `완료 (${stats?.total_completed ?? 0})` },
            { value: 'rejected', label: `거부 (${stats?.total_rejected ?? 0})` },
            { value: 'cancelled', label: `취소 (${stats?.total_cancelled ?? 0})` },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`border-b-2 px-4 py-2.5 text-sm transition-colors ${
                statusFilter === f.value
                  ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
          총 {data?.pagination.total ?? 0}건
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-16" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
                  <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">출금액</th>
                  <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">수수료</th>
                  <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">실수령액</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">지갑</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">네트워크</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">신청일</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((w) => (
                  <tr key={w.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-200">{w.seller_name || '-'}</p>
                        <p className="text-[12px] text-gray-400">{w.seller_email || ''}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-pink-500">{formatAmount(w.amount)}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatAmount(w.fee_amount)}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-pink-500">{formatAmount(w.net_amount)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400" title={w.wallet_address}>
                      {truncateAddress(w.wallet_address)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">{w.network}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLORS[w.status] || ''}`}>
                        {STATUS_LABELS[w.status] || w.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(w.requested_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-center gap-1.5">
                        <button
                          onClick={() => openModal('detail', w)}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          상세
                        </button>
                        {w.status === 'pending' && (
                          <>
                            <button
                              onClick={() => mutation.mutate({ id: w.id, action: 'approve' })}
                              disabled={mutation.isPending}
                              className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              승인
                            </button>
                            <button
                              onClick={() => openModal('reject', w)}
                              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Ban className="h-3 w-3" />
                              거부
                            </button>
                          </>
                        )}
                        {w.status === 'approved' && (
                          <button
                            onClick={() => openModal('complete', w)}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                          >
                            <CreditCard className="h-3 w-3" />
                            출금완료
                          </button>
                        )}
                        {(w.status === 'pending' || w.status === 'approved') && (
                          <button
                            onClick={() => openModal('cancel', w)}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <CircleOff className="h-3 w-3" />
                            취소
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center">
                      <Wallet className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                      <p className="mt-3 text-sm font-bold text-gray-400 dark:text-gray-500">
                        {statusFilter ? `${STATUS_LABELS[statusFilter] || statusFilter} 상태의 출금 요청이 없습니다` : '출금 요청이 없습니다'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm font-bold text-gray-500 dark:text-gray-400">
            {page} / {data.pagination.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {modalType === 'detail' && selectedWithdrawal && (
        <Modal title="출금 상세 정보" onClose={closeModal}>
          <div className="space-y-4">
            <DetailRow label="판매자" value={`${selectedWithdrawal.seller_name || '-'} (${selectedWithdrawal.seller_email || ''})`} />
            <DetailRow label="출금 요청액" value={formatAmount(selectedWithdrawal.amount)} highlight />
            <DetailRow label="수수료" value={formatAmount(selectedWithdrawal.fee_amount)} />
            <DetailRow label="실수령액" value={formatAmount(selectedWithdrawal.net_amount)} highlight />
            <DetailRow label="지갑 주소" value={selectedWithdrawal.wallet_address} mono />
            <DetailRow label="네트워크" value={selectedWithdrawal.network.toUpperCase()} />
            <DetailRow label="상태" value={
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLORS[selectedWithdrawal.status] || ''}`}>
                {STATUS_LABELS[selectedWithdrawal.status] || selectedWithdrawal.status}
              </span>
            } />
            {selectedWithdrawal.txid && <DetailRow label="TXID" value={selectedWithdrawal.txid} mono />}
            <DetailRow label="신청일시" value={formatDate(selectedWithdrawal.requested_at)} />
            {selectedWithdrawal.processed_at && <DetailRow label="처리일시" value={formatDate(selectedWithdrawal.processed_at)} />}
            {selectedWithdrawal.completed_at && <DetailRow label="완료일시" value={formatDate(selectedWithdrawal.completed_at)} />}
            {selectedWithdrawal.cancelled_at && <DetailRow label="취소일시" value={formatDate(selectedWithdrawal.cancelled_at)} />}
            {selectedWithdrawal.reject_reason && <DetailRow label="거부 사유" value={selectedWithdrawal.reject_reason} error />}
            {selectedWithdrawal.cancel_reason && <DetailRow label="취소 사유" value={selectedWithdrawal.cancel_reason} error />}
            {selectedWithdrawal.admin_memo && <DetailRow label="관리자 메모" value={selectedWithdrawal.admin_memo} />}
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {modalType === 'reject' && selectedWithdrawal && (
        <Modal title="출금 거부" onClose={closeModal}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{selectedWithdrawal.seller_name}</strong>의 출금 요청 (<span className="font-bold text-pink-500">{formatAmount(selectedWithdrawal.amount)}</span>)을 거부합니다.
            </p>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">거부 사유 *</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="거부 사유를 입력해주세요..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600" rows={3} />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">관리자 메모 (선택)</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeModal} className="rounded-full bg-gray-100 px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button
                onClick={() => mutation.mutate({ id: selectedWithdrawal.id, action: 'reject', reason, memo: memo || undefined })}
                disabled={!reason.trim() || mutation.isPending}
                className="rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
              >
                거부 확인
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Complete Modal */}
      {modalType === 'complete' && selectedWithdrawal && (
        <Modal title="출금 완료 처리" onClose={closeModal}>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                판매자에게 USDT를 전송한 후, 블록체인 TXID를 입력하여 출금을 완료 처리합니다.
              </p>
            </div>
            <DetailRow label="판매자" value={selectedWithdrawal.seller_name || '-'} />
            <DetailRow label="실수령액" value={formatAmount(selectedWithdrawal.net_amount)} highlight />
            <DetailRow label="지갑 주소" value={selectedWithdrawal.wallet_address} mono />
            <DetailRow label="네트워크" value={selectedWithdrawal.network.toUpperCase()} />
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">블록체인 TXID *</label>
              <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="0x... 또는 트랜잭션 해시"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">관리자 메모 (선택)</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeModal} className="rounded-full bg-gray-100 px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button
                onClick={() => mutation.mutate({ id: selectedWithdrawal.id, action: 'complete', txid, memo: memo || undefined })}
                disabled={!txid.trim() || mutation.isPending}
                className="rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
              >
                출금 완료
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Modal */}
      {modalType === 'cancel' && selectedWithdrawal && (
        <Modal title="출금 취소" onClose={closeModal}>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {selectedWithdrawal.status === 'approved'
                  ? '승인된 출금을 취소하면 판매자 잔액이 복원됩니다.'
                  : '대기 중인 출금 요청을 취소합니다.'}
              </p>
            </div>
            <DetailRow label="판매자" value={selectedWithdrawal.seller_name || '-'} />
            <DetailRow label="금액" value={formatAmount(selectedWithdrawal.amount)} highlight />
            <DetailRow label="현재 상태" value={STATUS_LABELS[selectedWithdrawal.status] || selectedWithdrawal.status} />
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">취소 사유 *</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="취소 사유를 입력해주세요..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600" rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeModal} className="rounded-full bg-gray-100 px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">닫기</button>
              <button
                onClick={() => mutation.mutate({ id: selectedWithdrawal.id, action: 'cancel', reason, memo: memo || undefined })}
                disabled={!reason.trim() || mutation.isPending}
                className="rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
              >
                취소 확인
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// --- Sub Components ---

function StatCard({ label, count, amount }: {
  label: string;
  count: number | null;
  amount: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-pink-500">{amount}</p>
      {count !== null && <p className="text-[12px] text-gray-400 mt-1">{count}건</p>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, highlight, error }: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-right text-sm break-all ${
        mono ? 'font-mono text-xs' : ''
      } ${highlight ? 'font-bold text-pink-500' : ''
      } ${error ? 'text-red-500' : highlight ? '' : 'text-gray-900 dark:text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}
