import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createExchange } from '@/lib/api/exchange';

interface ExchangeRequestFormProps {
  orderId: string;
  orderItemId: string;
  onSuccess?: (exchangeId: string) => void;
  onCancel?: () => void;
}

const REASON_OPTIONS = [
  { value: 'wrong_size', label: '사이즈 불일치' },
  { value: 'wrong_color', label: '색상 불일치' },
  { value: 'defective', label: '상품 불량' },
  { value: 'wrong_product', label: '오배송' },
  { value: 'other', label: '기타' },
];

export default function ExchangeRequestForm({ orderId, orderItemId, onSuccess, onCancel }: ExchangeRequestFormProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createExchange({
        order_id: orderId,
        order_item_id: orderItemId,
        reason_code: reasonCode,
        reason_detail: reasonDetail || undefined,
      }),
    onSuccess: (res) => onSuccess?.(res.data.id),
  });

  return (
    <div className="space-y-4 p-4 border rounded-2xl bg-white">
      <h3 className="text-lg font-semibold">교환 요청</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">교환 사유</label>
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          className="w-full border rounded-xl px-3 py-2"
        >
          <option value="">사유를 선택하세요</option>
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">상세 사유 (선택)</label>
        <textarea
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          className="w-full border rounded-xl px-3 py-2 h-24 resize-none"
          placeholder="상세 사유를 입력하세요"
        />
      </div>

      {mutation.isError && (
        <p className="text-red-600 text-sm">{(mutation.error as Error).message}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={!reasonCode || mutation.isPending}
          className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50"
        >
          {mutation.isPending ? '처리 중...' : '교환 요청'}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-2 border rounded-full hover:bg-gray-50">
            취소
          </button>
        )}
      </div>
    </div>
  );
}
