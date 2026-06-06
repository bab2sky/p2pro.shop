import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, RotateCcw, Upload, X, AlertCircle, ImagePlus } from 'lucide-react';
import { refundApi } from '@/lib/api/refunds';
import api from '@/lib/api/client';

const MAX_IMAGES = 5;
const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function RefundRequestPage() {
  const { t } = useTranslation();
  const reasonOptions = [
    { value: 'defective', label: t('refund.request.reason.defective', '상품 불량/파손') },
    { value: 'wrong_item', label: t('refund.request.reason.wrong_item', '오배송 (잘못된 상품)') },
    { value: 'not_delivered', label: t('refund.request.reason.not_delivered', '상품 미도착') },
    { value: 'not_as_described', label: t('refund.request.reason.not_as_described', '상품 설명과 불일치') },
    { value: 'change_of_mind', label: t('refund.request.reason.change_of_mind', '단순 변심') },
    { value: 'other', label: t('refund.request.reason.other', '기타') },
  ];
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_IMAGES - evidenceImages.length;
    if (remaining <= 0) {
      toast.warning(t('refund.request.errors.maxImages', { max: MAX_IMAGES, defaultValue: '최대 {{max}}장까지 첨부할 수 있습니다.' }));
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);

    try {
      const urls: string[] = [];
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post<{ data: { url: string } }>('/upload', formData);
        urls.push(res.data.data.url);
      }
      setEvidenceImages((prev) => [...prev, ...urls]);
    } catch {
      toast.error(t('refund.request.errors.uploadFail', '이미지 업로드에 실패했습니다.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setEvidenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: () =>
      refundApi.create(orderId!, {
        reason_code: reasonCode,
        reason,
        evidence_images: evidenceImages.length > 0 ? evidenceImages : undefined,
      }),
    onSuccess: (data) => {
      const refundId = data.data?.data?.refund_id;
      if (refundId) {
        navigate(`/refunds/${refundId}`);
      } else {
        navigate('/refunds');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonCode) { toast.error(t('refund.request.errors.selectReason', '환불 사유를 선택해주세요.')); return; }
    if (!reason.trim()) { toast.error(t('refund.request.errors.enterDetails', '상세 사유를 입력해주세요.')); return; }
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('refund.request.back', '뒤로가기')}
      </button>

      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
          <RotateCcw className="h-7 w-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('refund.request.title', '환불 요청')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('refund.request.reasonLabel', '환불 사유 *')}</label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className={inputClass}
              >
                <option value="">{t('refund.request.reasonSelect', '사유를 선택해주세요')}</option>
                {reasonOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('refund.request.detailsLabel', '상세 설명 *')}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('refund.request.detailsPlaceholder', '환불 사유를 자세히 설명해주세요.')}
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-gray-500 dark:text-gray-400">
                <ImagePlus className="h-3 w-3" />
                {t('refund.request.evidenceLabel', { max: MAX_IMAGES, defaultValue: '증거 이미지 (최대 {{max}}장)' })}
              </label>
              {evidenceImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {evidenceImages.map((url, i) => (
                    <div key={i} className="relative h-20 w-20">
                      <img src={url} alt={t('refund.request.evidenceAlt', { n: i + 1, defaultValue: '증거 {{n}}' })} className="h-full w-full rounded-xl border border-gray-200 object-cover dark:border-gray-700" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {evidenceImages.length < MAX_IMAGES && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 px-4 py-2.5 text-[13px] font-medium text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? t('refund.request.uploadingButton', '업로드 중...') : t('refund.request.addImage', '이미지 추가')}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
              <p className="mt-1 text-[11px] text-gray-400">
                {t('refund.request.evidenceHint', '상품 사진, 불량 부위 등 환불 사유를 증명할 수 있는 이미지를 첨부해주세요.')}
              </p>
            </div>
          </div>
        </div>

        {mutation.isError && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
            <AlertCircle className="h-4 w-4" />
            {(mutation.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
              ?? t('refund.request.errors.submitFail', '환불 요청 중 오류가 발생했습니다.')}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-3 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          <RotateCcw className="h-4 w-4" />
          {mutation.isPending ? t('refund.request.submitting', '요청 중...') : t('refund.request.submit', '환불 요청')}
        </button>

        <p className="text-center text-[11px] text-gray-400">
          {t('refund.request.autoApproveNote', '환불 요청 후 판매자가 3일 내 응답하지 않으면 자동 승인됩니다.')}
        </p>
      </form>
    </div>
  );
}
