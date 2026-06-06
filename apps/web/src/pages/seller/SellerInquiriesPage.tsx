import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HelpCircle,
  Send,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { getSellerInquiries, replyInquiry, type OrderInquiry } from '@/lib/api/exchange';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function SellerInquiriesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['seller', 'inquiries'], queryFn: () => getSellerInquiries() });
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const replyMut = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => replyInquiry(id, reply),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller', 'inquiries'] }),
  });

  const inquiries: OrderInquiry[] = data?.data || [];

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">1:1 문의 관리</h1>

      {isLoading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <HelpCircle className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">문의가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <div key={inq.id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        inq.status === 'pending' ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                      }`}>
                        {inq.status === 'pending' ? <Clock className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {inq.status === 'pending' ? '대기' : '답변완료'}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{inq.inquiry_type}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{inq.title}</p>
                    <p className="mt-0.5 text-[12px] text-gray-400">주문: {inq.order_id}</p>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{inq.content}</p>
                  </div>
                </div>

                {inq.seller_reply && (
                  <div className="mt-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                    <p className="mb-1 text-[12px] font-bold text-gray-900 dark:text-white">판매자 답변</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{inq.seller_reply}</p>
                  </div>
                )}

                {inq.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={replyText[inq.id] || ''}
                      onChange={(e) => setReplyText({ ...replyText, [inq.id]: e.target.value })}
                      placeholder="답변을 입력하세요..."
                      className={`flex-1 ${inputClass}`}
                    />
                    <button
                      onClick={() => replyMut.mutate({ id: inq.id, reply: replyText[inq.id] || '' })}
                      disabled={!replyText[inq.id]?.trim() || replyMut.isPending}
                      className="flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                      답변
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
