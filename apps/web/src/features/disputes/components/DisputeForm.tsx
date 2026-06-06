import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createDispute, type DisputeType } from '@/lib/api/disputes';
import { uploadImage } from '@/lib/api/reviews';
import { extractApiError } from '@/lib/api-error';

interface DisputeFormProps {
  orderId: string;
  onClose: () => void;
}

const disputeTypes: { value: DisputeType; label: string }[] = [
  { value: 'not_delivered', label: '미배송' },
  { value: 'defective', label: '불량/파손' },
  { value: 'wrong_item', label: '오배송' },
  { value: 'other', label: '기타' },
];

export function DisputeForm({ orderId, onClose }: DisputeFormProps) {
  const navigate = useNavigate();
  const [disputeType, setDisputeType] = useState<DisputeType>('not_delivered');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: () => createDispute({ order_id: orderId, dispute_type: disputeType, reason, evidence }),
    onSuccess: (res) => {
      navigate(`/disputes/${res.data.id}`);
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (evidence.length + files.length > 5) {
      toast.warning('증빙 이미지는 최대 5장까지 업로드할 수 있습니다.');
      return;
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadImage(file, 'disputes');
        setEvidence((prev) => [...prev, result.data.url]);
      }
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-4 text-lg font-semibold">분쟁 신청</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">분쟁 유형</label>
          <select
            value={disputeType}
            onChange={(e) => setDisputeType(e.target.value as DisputeType)}
            className="w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {disputeTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="분쟁 사유를 상세히 작성해 주세요..."
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            증빙 자료 ({evidence.length}/5)
          </label>
          {evidence.length > 0 && (
            <div className="mb-2 flex gap-2 flex-wrap">
              {evidence.map((url, i) => (
                <div key={i} className="relative w-20 h-20 border rounded overflow-hidden">
                  <img src={url} alt={`증빙 ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setEvidence((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs rounded-bl"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
          {evidence.length < 5 && (
            <label className="cursor-pointer rounded border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 inline-block">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              {uploading ? '업로드 중...' : '이미지 선택'}
            </label>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {extractApiError(mutation.error)}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={!reason.trim() || mutation.isPending}
            className="rounded bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {mutation.isPending ? '신청 중...' : '분쟁 신청'}
          </button>
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
