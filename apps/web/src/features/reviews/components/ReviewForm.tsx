import { useState, lazy, Suspense } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createReview, uploadImage } from '@/lib/api/reviews';
import { extractApiError } from '@/lib/api-error';
import { StarRating } from './StarRating';

const RichTextEditor = lazy(() => import('@/components/common/RichTextEditor'));

interface ReviewFormProps {
  orderId: string;
  productId: string;
  onSuccess: () => void;
}

export function ReviewForm({ orderId, productId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createReview({
        order_id: orderId,
        rating,
        content: content.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['reviewStats', productId] });
      onSuccess();
    },
  });

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      const result = await uploadImage(file, 'reviews');
      return result.data.url;
    } catch (err) {
      toast.error(extractApiError(err));
      throw err;
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h3 className="mb-4 text-[15px] font-bold text-gray-900 dark:text-white">리뷰 작성</h3>

      {/* Rating */}
      <div className="mb-4">
        <p className="mb-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">별점을 선택해주세요</p>
        <StarRating value={rating} onChange={setRating} size="lg" />
        {rating === 0 && mutation.isError && (
          <p className="mt-1.5 text-[12px] text-red-500">별점을 선택해주세요</p>
        )}
      </div>

      {/* Rich Text Editor */}
      <div className="mb-5">
        <p className="mb-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">
          리뷰 내용
        </p>
        <Suspense
          fallback={
            <div className="flex h-[220px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
          }
        >
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="상품은 어떠셨나요? 솔직한 리뷰를 남겨주세요. 사진도 첨부할 수 있습니다."
            onImageUpload={handleImageUpload}
          />
        </Suspense>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (rating === 0) return;
            mutation.mutate();
          }}
          disabled={rating === 0 || mutation.isPending}
          className="rounded-xl bg-gray-900 px-6 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {mutation.isPending ? '등록 중...' : '리뷰 등록'}
        </button>
        {mutation.isError && (
          <p className="text-[13px] text-red-500">
            {extractApiError(mutation.error)}
          </p>
        )}
      </div>
    </div>
  );
}
