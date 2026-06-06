import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyInquiries, createInquiry, type OrderInquiry } from '@/lib/api/exchange';
import { formatDate } from '@/lib/datetime';

const INQUIRY_TYPES = [
  { value: 'shipping', label: '배송 문의' },
  { value: 'product', label: '상품 문의' },
  { value: 'exchange', label: '교환 문의' },
  { value: 'refund', label: '환불 문의' },
  { value: 'etc', label: '기타' },
];

export default function OrderInquiryPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    order_id: '',
    inquiry_type: 'shipping',
    title: '',
    content: '',
  });

  const { data } = useQuery({
    queryKey: ['my-inquiries'],
    queryFn: () => getMyInquiries(),
  });

  const createMutation = useMutation({
    mutationFn: () => createInquiry(formData),
    onSuccess: () => {
      setShowForm(false);
      setFormData({ order_id: '', inquiry_type: 'shipping', title: '', content: '' });
      queryClient.invalidateQueries({ queryKey: ['my-inquiries'] });
    },
  });

  const inquiries: OrderInquiry[] = data?.data ?? [];

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return { text: '답변 대기', color: 'bg-yellow-100 text-yellow-700' };
      case 'replied': return { text: '답변 완료', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
      case 'resolved': return { text: '해결 완료', color: 'bg-green-100 text-green-700' };
      default: return { text: status, color: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 문의</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold rounded-full hover:bg-gray-800 dark:hover:bg-gray-100"
        >
          문의하기
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-2xl p-6 space-y-4">
          <input
            placeholder="주문 ID"
            value={formData.order_id}
            onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
            className="w-full border rounded-xl px-3 py-2"
          />
          <select
            value={formData.inquiry_type}
            onChange={(e) => setFormData({ ...formData, inquiry_type: e.target.value })}
            className="w-full border rounded-xl px-3 py-2"
          >
            {INQUIRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            placeholder="제목"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full border rounded-xl px-3 py-2"
          />
          <textarea
            placeholder="문의 내용"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full border rounded-xl px-3 py-2 h-32 resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!formData.order_id || !formData.title || !formData.content || createMutation.isPending}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50"
            >
              {createMutation.isPending ? '전송 중...' : '문의 등록'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-full hover:bg-gray-50">
              취소
            </button>
          </div>
        </div>
      )}

      {/* Inquiry list */}
      <div className="space-y-3">
        {inquiries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">문의 내역이 없습니다.</p>
        ) : (
          inquiries.map((inq) => {
            const status = statusLabel(inq.status);
            return (
              <div key={inq.id} className="bg-white border rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2 py-0.5 rounded text-xs ${status.color} mr-2`}>{status.text}</span>
                    <span className="text-xs text-gray-400">
                      {INQUIRY_TYPES.find((t) => t.value === inq.inquiry_type)?.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(inq.created_at)}</span>
                </div>
                <h3 className="font-medium mt-2">{inq.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{inq.content}</p>
                {inq.seller_reply && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">판매자 답변:</span>
                    <p className="mt-1 text-gray-700">{inq.seller_reply}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
