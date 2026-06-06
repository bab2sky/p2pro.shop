import { useQuery } from '@tanstack/react-query';
import { getSellerProfile } from '@/lib/api/sellerGrade';
import { SellerGradeBadge } from './SellerGradeBadge';

interface SellerPublicProfileProps {
  sellerId: string;
}

export function SellerPublicProfile({ sellerId }: SellerPublicProfileProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sellerProfile', sellerId],
    queryFn: () => getSellerProfile(sellerId).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-gray-500">
        판매자 정보를 불러올 수 없습니다
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {data.profile_image ? (
            <img src={data.profile_image} alt={data.store_name ?? ''} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gray-400">
              {data.store_name?.[0]?.toUpperCase() || 'S'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{data.store_name}</h2>
            <SellerGradeBadge grade={data.grade} variant="small" />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {data.member_since
              ? `${new Date(data.member_since).toLocaleDateString('ko-KR')}부터 활동`
              : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded bg-gray-50 p-3 text-center">
          <p className="text-lg font-bold text-gray-800">{data.total_sales}</p>
          <p className="text-xs text-gray-500">총 판매</p>
        </div>
        <div className="rounded bg-gray-50 p-3 text-center">
          <p className="text-lg font-bold text-gray-800">
            {data.avg_rating ? parseFloat(data.avg_rating).toFixed(1) : '0.0'}
          </p>
          <p className="text-xs text-gray-500">평균 평점</p>
        </div>
        <div className="rounded bg-gray-50 p-3 text-center">
          <p className="text-lg font-bold text-gray-800">
            {data.response_rate ? parseFloat(data.response_rate).toFixed(0) : '100'}%
          </p>
          <p className="text-xs text-gray-500">응답률</p>
        </div>
        <div className="rounded bg-gray-50 p-3 text-center">
          <p className="text-lg font-bold text-gray-800">{data.products_count}</p>
          <p className="text-xs text-gray-500">상품 수</p>
        </div>
      </div>

      {data.recent_reviews && data.recent_reviews.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">최근 리뷰</h3>
          <div className="space-y-2">
            {data.recent_reviews.slice(0, 3).map((review) => (
              <div key={review.id} className="rounded border p-3">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`h-3.5 w-3.5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-200'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-2 text-xs text-gray-400">
                    {review.created_at
                      ? new Date(review.created_at).toLocaleDateString('ko-KR')
                      : ''}
                  </span>
                </div>
                {review.content && (
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">{review.content}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
