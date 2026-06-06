import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveDispute, type Dispute, type DisputeResolution } from '@/lib/api/disputes';
import { extractApiError } from '@/lib/api-error';
import { Gavel } from 'lucide-react';

const RESOLUTION_OPTIONS: { value: DisputeResolution; label: string }[] = [
  { value: 'buyer_win', label: '구매자 승 (전액 환불)' },
  { value: 'seller_win', label: '판매자 승 (구매 확정)' },
  { value: 'partial_refund', label: '부분 환불' },
  { value: 'mutual_agreement', label: '상호 합의' },
];

interface AdminDisputeResolveProps {
  dispute: Dispute;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminDisputeResolve({ dispute, onSuccess, onCancel }: AdminDisputeResolveProps) {
  const queryClient = useQueryClient();
  const [resolution, setResolution] = useState<DisputeResolution>('buyer_win');
  const [resolutionNote, setResolutionNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      resolveDispute(dispute.id, {
        resolution,
        resolution_note: resolutionNote,
        refund_amount: resolution === 'partial_refund' ? parseFloat(refundAmount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDisputes'] });
      queryClient.invalidateQueries({ queryKey: ['dispute', dispute.id] });
      onSuccess();
    },
    onError: (err: unknown) => {
      setError(extractApiError(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!resolutionNote.trim()) {
      setError('처리 내용을 입력해주세요');
      return;
    }

    if (resolution === 'partial_refund') {
      const amount = parseFloat(refundAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('유효한 환불 금액을 입력해주세요');
        return;
      }
    }

    mutation.mutate();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <Gavel className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">분쟁 중재</h3>
      </div>

      <div className="p-5">
        {/* Dispute Info */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-1.5">
            <p className="text-sm text-gray-900 dark:text-gray-200">
              <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">분쟁 유형: </span>
              {dispute.dispute_type}
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-200">
              <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">사유: </span>
              {dispute.reason}
            </p>
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
              주문: {dispute.order_id}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">처리 결과</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as DisputeResolution)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600"
            >
              {RESOLUTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {resolution === 'partial_refund' && (
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">환불 금액 (USDT)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">처리 내용</label>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="분쟁 처리 내용을 상세히 작성해주세요"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-600"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-gray-100 px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-full bg-gray-900 px-6 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
            >
              {mutation.isPending ? '처리 중...' : '확인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
