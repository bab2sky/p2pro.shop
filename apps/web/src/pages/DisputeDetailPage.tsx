import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileText, Clock, MessageSquare } from 'lucide-react';
import { DisputeTimeline, DisputeChat } from '@/features/disputes';
import { getDispute } from '@/lib/api/disputes';
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_COLORS } from '@/constants/status-maps';

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: dispute, isLoading } = useQuery({
    queryKey: ['dispute', id],
    queryFn: () => getDispute(id!).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="flex flex-col items-center py-16">
        <AlertTriangle className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-bold text-gray-400">분쟁 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">분쟁 상세</h1>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            DISPUTE_STATUS_COLORS[dispute.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {DISPUTE_STATUS_LABELS[dispute.status] || dispute.status}
        </span>
      </div>

      {/* Dispute info */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <FileText className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">분쟁 정보</h2>
        </div>
        <div className="space-y-3 p-5">
          <dl className="space-y-2.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-gray-400">주문번호</dt>
              <dd className="font-mono text-gray-900 dark:text-white">{dispute.order_number || dispute.order_id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">분쟁 유형</dt>
              <dd className="font-bold text-gray-900 dark:text-white">
                {{
                  not_delivered: '미배송',
                  defective: '불량/파손',
                  wrong_item: '오배송',
                  other: '기타',
                }[dispute.dispute_type] || dispute.dispute_type}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">신청일</dt>
              <dd className="text-gray-900 dark:text-white">{new Date(dispute.created_at).toLocaleString('ko')}</dd>
            </div>
            {dispute.resolved_at && (
              <div className="flex justify-between">
                <dt className="text-gray-400">해결일</dt>
                <dd className="text-gray-900 dark:text-white">{new Date(dispute.resolved_at).toLocaleString('ko')}</dd>
              </div>
            )}
          </dl>

          <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
            <p className="mb-1 text-[12px] font-bold text-gray-400">사유</p>
            <p className="text-[13px] text-gray-700 dark:text-gray-300">{dispute.reason}</p>
          </div>

          {dispute.evidence && dispute.evidence.length > 0 && (
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-[12px] font-bold text-gray-400">증빙 자료</p>
              <div className="flex flex-wrap gap-2">
                {dispute.evidence.map((url: string, i: number) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-20 w-20 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
                  >
                    <img src={url} alt={`증빙 ${i + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {dispute.resolution && (
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-1 text-[12px] font-bold text-gray-400">중재 결과</p>
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                {{
                  buyer_win: '구매자 승 (전액 환불)',
                  seller_win: '판매자 승 (구매 확정)',
                  partial_refund: '부분 환불',
                  mutual_agreement: '상호 합의',
                }[dispute.resolution] || dispute.resolution}
              </p>
              {dispute.resolution_note && (
                <p className="mt-1 text-[13px] text-gray-500">{dispute.resolution_note}</p>
              )}
              {dispute.refund_amount && (
                <p className="mt-1 text-[13px]">
                  환불 금액: <span className="font-bold text-pink-500">{dispute.refund_amount} USDT</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <Clock className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">진행 상황</h2>
        </div>
        <div className="p-5">
          <DisputeTimeline disputeId={id!} status={dispute.status} createdAt={dispute.created_at} resolvedAt={dispute.resolved_at} />
        </div>
      </div>

      {/* Chat / Messages */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">메시지</h2>
        </div>
        <div className="p-5">
          <DisputeChat disputeId={id!} status={dispute.status} />
        </div>
      </div>
    </div>
  );
}
