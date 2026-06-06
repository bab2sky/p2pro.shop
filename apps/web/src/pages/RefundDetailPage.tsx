import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, AlertTriangle, FileText, Clock, CheckCircle, XCircle, ImagePlus } from 'lucide-react';
import { refundApi, type RefundRequestInfo } from '@/lib/api/refunds';
import {
  REFUND_STATUS_LABELS as statusLabels,
  REFUND_STATUS_COLORS as statusColors,
  REFUND_REASON_LABELS as reasonLabels,
} from '@/constants/status-maps';

function formatDateTime(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString();
}

export default function RefundDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['refund', id],
    queryFn: () => refundApi.getDetail(id!),
    enabled: !!id,
  });

  const refund: RefundRequestInfo | undefined = data?.data?.data;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (!refund) {
    return (
      <div className="flex flex-col items-center py-16">
        <RotateCcw className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-bold text-gray-400">{t('refund.detail.notFound', '환불 요청을 찾을 수 없습니다.')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('refund.detail.back', '뒤로가기')}
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('refund.detail.title', '환불 상세')}</h1>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusColors[refund.status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
          {statusLabels[refund.status] ?? refund.status}
        </span>
      </div>

      {/* Timeline */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <Clock className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('refund.detail.timeline.title', '처리 현황')}</h2>
        </div>
        <div className="space-y-3 p-5">
          <TimelineItem label={t('refund.detail.timeline.request', '환불 요청')} date={refund.created_at} done />
          <TimelineItem
            label={refund.seller_response === 'reject' ? t('refund.detail.timeline.sellerReject', '판매자 거절') : refund.seller_response === 'auto_approve' ? t('refund.detail.timeline.sellerAutoApprove', '자동 승인 (판매자 미응답)') : t('refund.detail.timeline.sellerApprove', '판매자 승인')}
            date={refund.seller_responded_at}
            done={!!refund.seller_responded_at}
            error={refund.seller_response === 'reject'}
          />
          <TimelineItem
            label={refund.status === 'admin_rejected' ? t('refund.detail.timeline.adminReject', '관리자 거절') : t('refund.detail.timeline.adminApprove', '관리자 환불 처리')}
            date={refund.processed_at}
            done={!!refund.processed_at}
            error={refund.status === 'admin_rejected'}
          />
        </div>
      </div>

      {/* Refund Info */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <FileText className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('refund.detail.info.title', '환불 정보')}</h2>
        </div>
        <dl className="space-y-2.5 p-5 text-[13px]">
          <Row label={t('refund.detail.info.orderNumber', '주문번호')} value={refund.order_number ?? '-'} mono />
          <Row label={t('refund.detail.info.orderTotal', '주문 금액')} value={`${refund.order_total} USDT`} />
          <Row label={t('refund.detail.info.reason', '환불 사유')} value={reasonLabels[refund.reason_code] ?? refund.reason_code} />
          <Row label={t('refund.detail.info.details', '상세 사유')} value={refund.reason} />
          <Row label={t('refund.detail.info.requestedAt', '요청일')} value={formatDateTime(refund.created_at)} />
        </dl>
      </div>

      {/* Evidence Images */}
      {refund.evidence_images && refund.evidence_images.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <ImagePlus className="h-4 w-4 text-gray-400" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('refund.detail.evidence.title', '증거 이미지')}</h2>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            {refund.evidence_images.map((img, i) => (
              <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                <img src={img} alt={t('refund.detail.evidence.alt', { n: i + 1, defaultValue: '증거 {{n}}' })} className="h-20 w-20 rounded-xl border border-gray-200 object-cover dark:border-gray-700" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Seller Response */}
      {refund.seller_responded_at && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('refund.detail.seller.title', '판매자 응답')}</h2>
          </div>
          <dl className="space-y-2.5 p-5 text-[13px]">
            <Row label={t('refund.detail.seller.response', '응답')} value={refund.seller_response === 'approve' ? t('refund.detail.seller.approve', '승인') : refund.seller_response === 'auto_approve' ? t('refund.detail.seller.autoApprove', '자동 승인') : t('refund.detail.seller.reject', '거절')} />
            {refund.seller_reason && <Row label={t('refund.detail.seller.rejectReason', '거절 사유')} value={refund.seller_reason} />}
            <Row label={t('refund.detail.seller.respondedAt', '응답일')} value={formatDateTime(refund.seller_responded_at)} />
          </dl>
        </div>
      )}

      {/* Admin Processing */}
      {refund.processed_at && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('refund.detail.admin.title', '관리자 처리')}</h2>
          </div>
          <dl className="space-y-2.5 p-5 text-[13px]">
            <Row label={t('refund.detail.admin.type', '환불 유형')} value={refund.refund_type === 'full' ? t('refund.detail.admin.full', '전액 환불') : t('refund.detail.admin.partial', '부분 환불')} />
            {refund.refund_amount && <Row label={t('refund.detail.admin.amount', '환불 금액')} value={`${refund.refund_amount} USDT`} highlight />}
            {refund.admin_note && <Row label={t('refund.detail.admin.note', '관리자 메모')} value={refund.admin_note} />}
            <Row label={t('refund.detail.admin.processedAt', '처리일')} value={formatDateTime(refund.processed_at)} />
          </dl>
        </div>
      )}

      {/* Actions */}
      {refund.status === 'seller_rejected' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/10">
          <p className="mb-3 text-[13px] text-red-600 dark:text-red-400">
            {t('refund.detail.rejectedNote', '판매자가 환불을 거절했습니다. 분쟁을 제기하여 관리자 중재를 받을 수 있습니다.')}
          </p>
          <button
            onClick={() => navigate('/disputes', { state: { orderId: refund.order_id } })}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-red-500 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-red-600"
          >
            <AlertTriangle className="h-4 w-4" />
            {t('refund.detail.fileDispute', '분쟁 제기')}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-400">{label}</dt>
      <dd className={`${mono ? 'font-mono' : ''} ${highlight ? 'font-bold text-emerald-500' : 'text-gray-900 dark:text-white'}`}>{value}</dd>
    </div>
  );
}

function TimelineItem({ label, date, done, error }: { label: string; date: string | null; done: boolean; error?: boolean }) {
  const Icon = done ? (error ? XCircle : CheckCircle) : Clock;
  const iconColor = done ? (error ? 'text-red-500' : 'text-emerald-500') : 'text-gray-300 dark:text-gray-600';

  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <span className={`text-[13px] font-medium ${done ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
      {date && <span className="ml-auto text-[11px] text-gray-400">{new Date(date).toLocaleDateString()}</span>}
    </div>
  );
}
