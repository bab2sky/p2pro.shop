import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminReviewItem, type LowRatedProduct } from '@/lib/api/admin';
import { confirmAction } from '@/lib/confirm';
import { Search, Star, MessageSquare, Eye, EyeOff, Trash2, AlertTriangle, ShieldAlert, ChevronLeft, ChevronRight, BarChart3, Flag, EyeOff as EyeOffIcon, TrendingDown, Clock, CalendarDays } from 'lucide-react';

type FilterType = '' | 'reported' | 'hidden' | 'low' | 'no_reply' | 'has_reply';
type TabType = 'reviews' | 'low_rated';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-500 text-xs">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('reviews');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('');
  const [sort, setSort] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });

  const { data: statsData } = useQuery({
    queryKey: ['admin', 'reviews', 'stats'],
    queryFn: () => adminApi.getReviewStats().then((r) => r.data.data),
  });

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', 'list', page, filter, search, sort],
    queryFn: () => adminApi.getAdminReviews(page, 20, filter || undefined, search || undefined, sort || undefined).then((r) => r.data),
    enabled: tab === 'reviews',
  });

  const { data: lowRatedData } = useQuery({
    queryKey: ['admin', 'reviews', 'low-rated'],
    queryFn: () => adminApi.getLowRatedProducts().then((r) => r.data.data),
    enabled: tab === 'low_rated',
  });

  const hideMut = useMutation({
    mutationFn: (id: string) => adminApi.hideReview(id),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteReview(id),
    onSuccess: () => { setDeleteId(null); invalidate(); },
  });

  const suspendMut = useMutation({
    mutationFn: (id: string) => adminApi.suspendProduct(id, '저평가 리뷰 다수로 인한 판매 중지'),
    onSuccess: invalidate,
  });

  const stats = statsData ?? {
    total_reviews: 0, avg_rating: '0', reported_count: 0, hidden_count: 0,
    low_rating_count: 0, no_reply_count: 0, week_new_count: 0,
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleSort = (field: string) => {
    if (sort === `${field}_desc`) setSort(`${field}_asc`);
    else if (sort === `${field}_asc`) setSort('');
    else setSort(`${field}_desc`);
    setPage(1);
  };

  const filters: { value: FilterType; label: string; count?: number }[] = [
    { value: '', label: '전체', count: stats.total_reviews },
    { value: 'reported', label: '신고됨', count: stats.reported_count },
    { value: 'hidden', label: '숨김', count: stats.hidden_count },
    { value: 'low', label: '저평가 (1-2점)', count: stats.low_rating_count },
    { value: 'no_reply', label: '미답변', count: stats.no_reply_count },
    { value: 'has_reply', label: '답변완료' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">리뷰 관리</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="전체 리뷰" value={stats.total_reviews} icon={<BarChart3 className="h-4 w-4 text-gray-600" />} iconBg="bg-gray-100" />
        <StatCard label="평균 평점" value={`★ ${parseFloat(stats.avg_rating).toFixed(1)}`} color="text-yellow-600" icon={<Star className="h-4 w-4 text-yellow-600" />} iconBg="bg-yellow-50" />
        <StatCard label="신고됨" value={stats.reported_count} color="text-red-600" highlight={stats.reported_count > 0} icon={<Flag className="h-4 w-4 text-red-600" />} iconBg="bg-red-50" />
        <StatCard label="숨김 처리" value={stats.hidden_count} color="text-gray-500" icon={<EyeOffIcon className="h-4 w-4 text-gray-500" />} iconBg="bg-gray-100" />
        <StatCard label="저평가 (1-2점)" value={stats.low_rating_count} color="text-orange-600" icon={<TrendingDown className="h-4 w-4 text-orange-600" />} iconBg="bg-orange-50" />
        <StatCard label="미답변" value={stats.no_reply_count} color="text-gray-900 dark:text-white" icon={<Clock className="h-4 w-4 text-gray-600" />} iconBg="bg-gray-100" />
        <StatCard label="최근 7일" value={stats.week_new_count} color="text-green-600" icon={<CalendarDays className="h-4 w-4 text-green-600" />} iconBg="bg-green-50" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab('reviews')}
          className={`px-4 py-2.5 text-sm border-b-2 transition ${tab === 'reviews' ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          리뷰 목록
        </button>
        <button
          onClick={() => setTab('low_rated')}
          className={`px-4 py-2.5 text-sm border-b-2 transition ${tab === 'low_rated' ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          저평가 상품 모니터링
          {lowRatedData && lowRatedData.length > 0 && (
            <span className="ml-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{lowRatedData.length}</span>
          )}
        </button>
      </div>

      {tab === 'reviews' && (
        <>
          {/* Search + Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="relative flex flex-1 gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="상품명, 판매자, 구매자, 리뷰 내용 검색..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
              <button type="submit" className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">검색</button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">초기화</button>
              )}
            </form>
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => { setFilter(f.value); setPage(1); }}
                className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
                  filter === f.value
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {f.label}
                {f.count !== undefined && f.count > 0 && (
                  <span className="ml-1 text-xs opacity-75">({f.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Reviews Table */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상품</th>
                      <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
                      <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</th>
                      <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">
                        <button onClick={() => toggleSort('rating')} className="hover:text-gray-900 dark:hover:text-white">
                          평점{sort === 'rating_asc' ? ' ▲' : sort === 'rating_desc' ? ' ▼' : ' ↕'}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400 max-w-[300px]">내용</th>
                      <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                      <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">
                        <button onClick={() => toggleSort('created')} className="hover:text-gray-900 dark:hover:text-white">
                          작성일{sort === 'created_asc' ? ' ▲' : sort === 'created_desc' ? ' ▼' : ''}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewsData?.data.map((review) => (
                      <ReviewRow
                        key={review.id}
                        review={review}
                        onHide={() => hideMut.mutate(review.id)}
                        onDelete={() => setDeleteId(review.id)}
                        onSuspendProduct={async () => {
                          if (await confirmAction(`"${review.product_title}" 상품을 판매 중지하시겠습니까?`)) {
                            suspendMut.mutate(review.product_id);
                          }
                        }}
                        hideLoading={hideMut.isPending}
                      />
                    ))}
                    {reviewsData?.data.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center">
                          <MessageSquare className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                          <p className="mt-3 font-bold text-gray-400">{search ? '검색 결과가 없습니다.' : '리뷰가 없습니다.'}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {reviewsData?.pagination && reviewsData.pagination.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-sm font-bold text-gray-500">{page} / {reviewsData.pagination.total_pages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= reviewsData.pagination.total_pages}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Low Rated Products Tab */}
      {tab === 'low_rated' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">저평가 상품 모니터링</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">리뷰 2건 이상, 평균 평점 3.0 이하인 상품을 자동으로 감지합니다. 상품 품질 문제가 의심되면 판매 중지 조치를 취할 수 있습니다.</p>
              </div>
            </div>
          </div>

          {!lowRatedData || lowRatedData.length === 0 ? (
            <div className="py-16 text-center">
              <Star className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
              <p className="mt-3 font-bold text-gray-400">저평가 상품이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상품명</th>
                    <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">리뷰 수</th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">평균 평점</th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">저평가 수</th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">조치</th>
                  </tr>
                </thead>
                <tbody>
                  {lowRatedData.map((item: LowRatedProduct) => {
                    const avgRating = parseFloat(item.avg_rating);
                    const ratingColor = avgRating <= 1.5 ? 'text-red-600' : avgRating <= 2.5 ? 'text-orange-600' : 'text-yellow-600';
                    return (
                      <tr key={item.product_id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                        <td className="px-5 py-3">
                          <a href={`/products/${item.product_id}`} target="_blank" rel="noreferrer" className="font-bold text-gray-900 hover:underline dark:text-white">
                            {item.product_title}
                          </a>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{item.seller_name}</td>
                        <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">{item.review_count}건</td>
                        <td className={`px-5 py-3 text-center font-bold ${ratingColor}`}>
                          ★ {avgRating.toFixed(1)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                            {item.low_rating_count}건
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            item.product_status === 'active' ? 'bg-green-100 text-green-700' :
                            item.product_status === 'suspended' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {item.product_status === 'active' ? '판매중' : item.product_status === 'suspended' ? '정지됨' : item.product_status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {item.product_status === 'active' && (
                            <button
                              onClick={async () => {
                                if (await confirmAction(`"${item.product_title}" 상품을 판매 중지하시겠습니까?`)) {
                                  suspendMut.mutate(item.product_id);
                                }
                              }}
                              disabled={suspendMut.isPending}
                              className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                            >
                              판매 중지
                            </button>
                          )}
                          {item.product_status === 'suspended' && (
                            <span className="text-xs text-gray-500">중지됨</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-96 rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">리뷰 삭제</h3>
            </div>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              이 리뷰를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              숨김 처리를 원하시면 취소 후 숨김 버튼을 사용하세요.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRow({
  review,
  onHide,
  onDelete,
  onSuspendProduct,
  hideLoading,
}: {
  review: AdminReviewItem;
  onHide: () => void;
  onDelete: () => void;
  onSuspendProduct: () => void;
  hideLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className={`border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50 ${review.is_hidden ? 'opacity-50' : ''}`}>
        <td className="px-5 py-3 max-w-[160px]">
          <a href={`/products/${review.product_id}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-gray-900 hover:underline dark:text-white truncate block">
            {review.product_title}
          </a>
          {review.product_status === 'suspended' && (
            <span className="text-xs text-red-500">판매중지</span>
          )}
        </td>
        <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">{review.seller_name}</td>
        <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">{review.buyer_nickname}</td>
        <td className="px-5 py-3 text-center">
          <span className={`font-bold ${review.rating <= 2 ? 'text-red-600' : review.rating <= 3 ? 'text-orange-500' : 'text-green-600'}`}>
            <Stars rating={review.rating} />
          </span>
        </td>
        <td className="px-5 py-3 max-w-[300px]">
          {review.content ? (
            <button onClick={() => setExpanded(!expanded)} className="text-left text-sm text-gray-700 dark:text-gray-300">
              {expanded ? review.content : review.content.length > 50 ? review.content.slice(0, 50) + '...' : review.content}
            </button>
          ) : (
            <span className="text-xs text-gray-400">내용 없음</span>
          )}
        </td>
        <td className="px-5 py-3 text-center">
          <div className="flex flex-col items-center gap-1">
            {review.is_reported && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">신고</span>
            )}
            {review.is_hidden && (
              <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">숨김</span>
            )}
            {review.seller_reply && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">답변</span>
            )}
            {!review.is_reported && !review.is_hidden && !review.seller_reply && (
              <span className="text-gray-400 text-xs">-</span>
            )}
          </div>
        </td>
        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {review.created_at ? new Date(review.created_at).toLocaleDateString() : '-'}
        </td>
        <td className="px-5 py-3 text-center">
          <div className="flex justify-center gap-1">
            <button
              onClick={onHide}
              disabled={hideLoading}
              className="rounded-full bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              title={review.is_hidden ? '숨김 해제' : '숨김 처리'}
            >
              {review.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onDelete} className="rounded-full bg-gray-100 p-1.5 text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/30">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {review.product_status === 'active' && review.rating <= 2 && (
              <button onClick={onSuspendProduct} className="rounded-full bg-gray-100 p-1.5 text-orange-600 hover:bg-orange-50 dark:bg-gray-800 dark:hover:bg-orange-900/30" title="상품 판매 중지">
                <ShieldAlert className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {/* Expanded row for reply/report details */}
      {expanded && (review.seller_reply || review.report_reason) && (
        <tr className="bg-gray-50 dark:bg-gray-800/50">
          <td colSpan={8} className="px-6 py-3">
            {review.seller_reply && (
              <div className="mb-2">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자 답변:</span>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{review.seller_reply}</p>
              </div>
            )}
            {review.report_reason && (
              <div>
                <span className="text-[12px] font-bold text-red-600">신고 사유:</span>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{review.report_reason}</p>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatCard({ label, value, color, highlight, icon, iconBg }: { label: string; value: number | string; color?: string; highlight?: boolean; icon?: React.ReactNode; iconBg?: string }) {
  return (
    <div className={`rounded-2xl bg-gray-50 p-4 dark:bg-gray-900 ${highlight ? 'ring-2 ring-red-400' : ''}`}>
      <div className="flex items-center gap-2">
        {icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg || 'bg-gray-100'}`}>
            {icon}
          </div>
        )}
        <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className={`mt-2 text-xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}
