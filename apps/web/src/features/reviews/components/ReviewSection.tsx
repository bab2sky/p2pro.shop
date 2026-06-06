import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sanitizeHtml } from '@/lib/sanitize';
import { getProductReviews, getReviewStats, getReviewableOrders } from '@/lib/api/reviews';
import { useAuthStore } from '@/stores/auth';
import { ReviewStats } from './ReviewStats';
import { ReviewForm } from './ReviewForm';
import { StarRating } from './StarRating';
import { Pencil, ChevronLeft, ChevronRight, MessageSquare, ThumbsUp } from 'lucide-react';

interface ReviewSectionProps {
  productId: string;
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const [page, setPage] = useState(1);
  const [writingOrderId, setWritingOrderId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const isLoggedIn = !!useAuthStore((s) => s.accessToken);

  const { data: statsData } = useQuery({
    queryKey: ['reviewStats', productId],
    queryFn: () => getReviewStats(productId),
  });

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => getProductReviews(productId, { page, per_page: 10 }),
  });

  const { data: reviewableData } = useQuery({
    queryKey: ['reviewableOrders', productId],
    queryFn: () => getReviewableOrders(productId),
    enabled: isLoggedIn,
  });

  const reviewableOrders = reviewableData?.data ?? [];
  const totalPages = reviewsData?.pagination.total_pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Stats */}
      {statsData?.data && <ReviewStats stats={statsData.data} />}

      {/* Reviewable orders CTA */}
      {reviewableOrders.length > 0 && !writingOrderId && (
        <div className="flex items-center justify-between rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4 dark:border-purple-900/30 dark:bg-purple-900/10">
          <div>
            <p className="text-[14px] font-bold text-purple-900 dark:text-purple-300">
              구매하신 상품의 리뷰를 남겨주세요!
            </p>
            <p className="mt-0.5 text-[12px] text-purple-600 dark:text-purple-400">
              {reviewableOrders.length}건의 주문에 리뷰를 작성할 수 있습니다
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {reviewableOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => setWritingOrderId(order.id)}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-purple-700"
              >
                <Pencil className="h-3.5 w-3.5" />
                리뷰 작성
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      {writingOrderId && (
        <ReviewForm
          orderId={writingOrderId}
          productId={productId}
          onSuccess={() => setWritingOrderId(null)}
        />
      )}

      {/* Reviews List */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-white" />
        </div>
      )}

      {reviewsData && (
        <>
          <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
            {reviewsData.data.map((review) => (
              <div key={review.id} className="py-5 first:pt-0">
                {/* Header */}
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[12px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {(review.user_nickname || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[14px] font-bold text-gray-900 dark:text-white">
                        {review.user_nickname || '익명'}
                      </span>
                      <div className="flex items-center gap-2">
                        <StarRating value={review.rating} readonly size="sm" />
                      </div>
                    </div>
                  </div>
                  <span className="text-[12px] text-gray-400">
                    {new Date(review.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                {/* Content (supports rich text HTML) */}
                {review.content && (
                  <div
                    className="prose prose-sm mb-3 max-w-none text-gray-700 dark:prose-invert dark:text-gray-300 prose-img:rounded-xl prose-img:my-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(review.content) }}
                  />
                )}

                {/* Legacy image attachments */}
                {review.images && review.images.length > 0 && (
                  <div className="mb-3 flex gap-2">
                    {review.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(img)}
                        className="group relative h-[80px] w-[80px] overflow-hidden rounded-xl sm:h-[100px] sm:w-[100px]"
                      >
                        <img
                          src={img}
                          alt={`리뷰 사진 ${i + 1}`}
                          className="h-full w-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Helpful button */}
                <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  도움이 돼요
                </button>
              </div>
            ))}

            {reviewsData.data.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <MessageSquare className="mb-3 h-10 w-10 stroke-[1.2]" />
                <p className="text-[15px] font-bold">아직 리뷰가 없습니다</p>
                <p className="mt-1 text-[13px]">첫 리뷰를 남겨주세요!</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | 'dots')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('dots');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === 'dots' ? (
                    <span key={`dots-${idx}`} className="px-1 text-[13px] text-gray-400">...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold transition-colors ${
                        page === item
                          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="리뷰 사진 확대"
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
