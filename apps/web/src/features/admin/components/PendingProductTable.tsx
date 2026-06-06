import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Package, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi, type AdminProduct, type ProductStats } from '@/lib/api/admin';
import { getProduct } from '@/lib/api/products';

type StatusFilter = '' | 'pending' | 'active' | 'rejected' | 'suspended';

export function PendingProductTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedAdminProduct, setSelectedAdminProduct] = useState<AdminProduct | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [sort, setSort] = useState('');

  const { data: statsData } = useQuery({
    queryKey: ['admin', 'products', 'stats'],
    queryFn: () => adminApi.getProductStats().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', 'list', page, statusFilter, search, sort],
    queryFn: () =>
      adminApi.getProducts(page, 20, statusFilter || undefined, search || undefined, sort || undefined).then((r) => r.data),
  });

  const { data: productDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['productDetail', selectedProductId],
    queryFn: () => getProduct(selectedProductId!),
    enabled: !!selectedProductId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveProduct(id),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectProduct(id, reason),
    onSuccess: () => { setRejectId(null); setRejectReason(''); invalidate(); },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.suspendProduct(id, reason),
    onSuccess: () => { setSuspendId(null); setSuspendReason(''); invalidate(); },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => adminApi.restoreProduct(id),
    onSuccess: invalidate,
  });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  };

  const toggleSort = (field: string) => {
    if (sort === `${field}_desc`) {
      setSort(`${field}_asc`);
    } else if (sort === `${field}_asc`) {
      setSort('');
    } else {
      setSort(`${field}_desc`);
    }
    setPage(1);
  };

  const sortIcon = (field: string) => {
    if (sort === `${field}_desc`) return ' ▼';
    if (sort === `${field}_asc`) return ' ▲';
    return ' ↕';
  };

  const stats: ProductStats = statsData ?? {
    total_products: 0, pending_products: 0, active_products: 0,
    rejected_products: 0, suspended_products: 0, today_new: 0,
    out_of_stock: 0, total_sold: 0,
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: '심사대기', active: '판매중', rejected: '반려',
      suspended: '정지', inactive: '비활성',
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return map[s] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold dark:text-white">상품 관리</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatsCard label="전체 상품" value={stats.total_products} />
        <StatsCard label="심사 대기" value={stats.pending_products} highlight="yellow" />
        <StatsCard label="판매중" value={stats.active_products} highlight="green" />
        <StatsCard label="반려" value={stats.rejected_products} highlight="red" />
        <StatsCard label="정지" value={stats.suspended_products} highlight="orange" />
        <StatsCard label="오늘 등록" value={stats.today_new} />
        <StatsCard label="품절" value={stats.out_of_stock} />
        <StatsCard label="총 판매수" value={stats.total_sold} />
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="상품명, 판매자명, 이메일로 검색..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <button type="submit" className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
          검색
        </button>
      </form>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {([
          ['', '전체'],
          ['pending', '심사대기'],
          ['active', '판매중'],
          ['rejected', '반려'],
          ['suspended', '정지'],
        ] as [StatusFilter, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => handleFilterChange(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              statusFilter === value
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {label}
            {value === 'pending' && stats.pending_products > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] text-white">
                {stats.pending_products}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading || !data ? (
        <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-64" role="status" aria-label="로딩 중" />
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상품명</th>
                    <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
                    <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">카테고리</th>
                    <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">
                      <button onClick={() => toggleSort('price')} className="hover:text-gray-900 dark:hover:text-white">가격{sortIcon('price')}</button>
                    </th>
                    <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">
                      <button onClick={() => toggleSort('stock')} className="hover:text-gray-900 dark:hover:text-white">재고{sort === 'stock_asc' ? ' ▲' : ''}</button>
                    </th>
                    <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">
                      <button onClick={() => toggleSort('sold')} className="hover:text-gray-900 dark:hover:text-white">판매{sort === 'sold_desc' ? ' ▼' : ''}</button>
                    </th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">
                      <button onClick={() => toggleSort('rating')} className="hover:text-gray-900 dark:hover:text-white">평점{sortIcon('rating')}</button>
                    </th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">
                      <button onClick={() => toggleSort('review_count')} className="hover:text-gray-900 dark:hover:text-white">리뷰{sortIcon('review_count')}</button>
                    </th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                    <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">등록일</th>
                    <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((product) => (
                    <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3 max-w-[200px]">
                        <button
                          onClick={() => { setSelectedProductId(product.id); setSelectedAdminProduct(product); }}
                          className="text-left font-medium text-gray-900 hover:underline dark:text-white truncate block max-w-full"
                        >
                          {product.title}
                        </button>
                      </td>
                      <td className="px-5 py-3 dark:text-gray-300">
                        <div className="text-sm">{product.seller_name}</div>
                        {product.seller_email && (
                          <div className="text-[12px] text-gray-400">{product.seller_email}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-gray-500 dark:text-gray-400">
                        {product.category_name || '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-pink-500">
                        {product.final_price ? `$${parseFloat(product.final_price).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-5 py-3 text-right dark:text-gray-300">
                        <span className={product.stock === 0 ? 'text-red-500 font-bold' : ''}>
                          {product.stock ?? '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right dark:text-gray-300">
                        {product.sold_count ?? 0}
                      </td>
                      <td className="px-5 py-3 text-center dark:text-gray-300">
                        {product.avg_rating && parseFloat(product.avg_rating) > 0 ? (
                          <span className="inline-flex items-center gap-0.5">
                            <span className="text-yellow-500 text-xs">★</span>
                            <span className="text-sm font-medium">{parseFloat(product.avg_rating).toFixed(1)}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center dark:text-gray-300 text-sm">
                        {(product.review_count ?? 0) > 0 ? (
                          <span>{product.review_count}건</span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColor(product.status)}`}>
                          {statusLabel(product.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[12px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {product.created_at ? new Date(product.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {product.status === 'pending' && (
                            <>
                              <ActionBtn color="green" onClick={() => approveMutation.mutate(product.id)} disabled={approveMutation.isPending}>
                                승인
                              </ActionBtn>
                              <ActionBtn color="red" onClick={() => setRejectId(product.id)}>
                                반려
                              </ActionBtn>
                            </>
                          )}
                          {product.status === 'active' && (
                            <ActionBtn color="orange" onClick={() => setSuspendId(product.id)}>
                              정지
                            </ActionBtn>
                          )}
                          {(product.status === 'suspended' || product.status === 'rejected') && (
                            <ActionBtn color="gray" onClick={() => restoreMutation.mutate(product.id)} disabled={restoreMutation.isPending}>
                              복원
                            </ActionBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.data.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-5 py-12 text-center">
                        <Package className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                        <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">
                          {search ? '검색 결과가 없습니다.' : '상품이 없습니다.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">
                {page} / {data.pagination.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pagination.total_pages}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setSelectedProductId(null); setSelectedAdminProduct(null); }}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-32 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  <div className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  <div className="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            ) : productDetail ? (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                  <h3 className="text-sm font-bold dark:text-white">상품 상세</h3>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColor(productDetail.status)}`}>
                      {statusLabel(productDetail.status)}
                    </span>
                    <button onClick={() => { setSelectedProductId(null); setSelectedAdminProduct(null); }} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="px-5 py-4">
                  {/* Images */}
                  {productDetail.images.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-2">상품 이미지 ({productDetail.images.length})</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {productDetail.images.map((img) => (
                          <img
                            key={img.id}
                            src={img.image_url}
                            alt=""
                            className="w-24 h-24 object-cover rounded-xl border border-gray-200 dark:border-gray-800 flex-shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    <DetailRow label="상품명" value={productDetail.title} />
                    <DetailRow label="판매자" value={`${productDetail.seller_name}${selectedAdminProduct?.seller_email ? ` (${selectedAdminProduct.seller_email})` : ''}`} />
                    {productDetail.category && (
                      <DetailRow label="카테고리" value={buildBreadcrumb(productDetail.category)} />
                    )}

                    {/* Description */}
                    {productDetail.description && (
                      <div>
                        <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-1">상품 설명</p>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {productDetail.description}
                        </div>
                      </div>
                    )}

                    {/* Price info */}
                    <div>
                      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-2">가격 정보</p>
                      <div className="grid grid-cols-4 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800">
                        <div>
                          <p className="text-[12px] font-bold text-gray-400">기본가</p>
                          <p className="font-medium text-pink-500">${parseFloat(productDetail.base_price).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-400">마진율</p>
                          <p className="font-medium dark:text-gray-200">{parseFloat(productDetail.margin_rate).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-400">최종가</p>
                          <p className="font-bold text-pink-500">${parseFloat(productDetail.final_price).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-400">배송비</p>
                          <p className="font-medium dark:text-gray-200">{parseFloat(productDetail.shipping_fee) > 0 ? `$${parseFloat(productDetail.shipping_fee).toFixed(2)}` : '무료'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Options */}
                    {productDetail.options.length > 0 && (
                      <div>
                        <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-2">상품 옵션 ({productDetail.options.length})</p>
                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 dark:border-gray-800">
                                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">옵션명</th>
                                <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">추가가격</th>
                                <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">재고</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productDetail.options.map((opt) => (
                                <tr key={opt.id} className="border-b border-gray-50 dark:border-gray-800/50">
                                  <td className="px-5 py-3 dark:text-gray-300">{opt.option_name}: {opt.option_value}</td>
                                  <td className="px-5 py-3 text-right text-pink-500">
                                    {opt.additional_price && parseFloat(opt.additional_price) > 0 ? `+$${parseFloat(opt.additional_price).toFixed(2)}` : '-'}
                                  </td>
                                  <td className="px-5 py-3 text-right dark:text-gray-300">
                                    <span className={opt.stock === 0 ? 'text-red-500 font-bold' : ''}>
                                      {opt.stock ?? '-'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-5 gap-3">
                      <DetailRow label="재고" value={String(productDetail.stock)} />
                      <DetailRow label="판매수" value={String(productDetail.sold_count)} />
                      <DetailRow label="조회수" value={String(productDetail.view_count)} />
                      <DetailRow label="찜" value={String(productDetail.wishlist_count)} />
                      <DetailRow label="리뷰" value={`${productDetail.review_count}건 (${productDetail.avg_rating ? parseFloat(productDetail.avg_rating).toFixed(1) : '-'})`} />
                    </div>

                    {/* Return policy */}
                    {productDetail.return_policy && (
                      <div>
                        <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-1">반품/교환 정책</p>
                        <p className="text-sm dark:text-gray-300 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800 whitespace-pre-wrap">{productDetail.return_policy}</p>
                      </div>
                    )}

                    {selectedAdminProduct?.rejected_reason && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                        <p className="text-[12px] font-bold text-red-700 dark:text-red-400">반려/정지 사유</p>
                        <p className="mt-1 text-sm text-red-600 dark:text-red-300">{selectedAdminProduct.rejected_reason}</p>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="grid grid-cols-3 gap-3">
                      <DetailRow label="등록일" value={productDetail.created_at ? new Date(productDetail.created_at).toLocaleString() : '-'} />
                      {selectedAdminProduct?.approved_at && (
                        <DetailRow label="승인일" value={new Date(selectedAdminProduct.approved_at).toLocaleString()} />
                      )}
                      {selectedAdminProduct?.updated_at && (
                        <DetailRow label="수정일" value={new Date(selectedAdminProduct.updated_at).toLocaleString()} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                  {productDetail.status === 'pending' && (
                    <>
                      <ActionBtn color="green" onClick={() => { approveMutation.mutate(selectedProductId); setSelectedProductId(null); setSelectedAdminProduct(null); }}>
                        승인
                      </ActionBtn>
                      <ActionBtn color="red" onClick={() => { setRejectId(selectedProductId); setSelectedProductId(null); setSelectedAdminProduct(null); }}>
                        반려
                      </ActionBtn>
                    </>
                  )}
                  {productDetail.status === 'active' && (
                    <ActionBtn color="orange" onClick={() => { setSuspendId(selectedProductId); setSelectedProductId(null); setSelectedAdminProduct(null); }}>
                      정지
                    </ActionBtn>
                  )}
                  {(productDetail.status === 'suspended' || productDetail.status === 'rejected') && (
                    <ActionBtn color="gray" onClick={() => { restoreMutation.mutate(selectedProductId); setSelectedProductId(null); setSelectedAdminProduct(null); }}>
                      복원
                    </ActionBtn>
                  )}
                  <button
                    onClick={() => { setSelectedProductId(null); setSelectedAdminProduct(null); }}
                    className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <Package className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                <p className="mt-3 text-sm font-bold text-red-500">상품 정보를 불러올 수 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-96 rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-sm font-bold dark:text-white">상품 반려</h3>
            </div>
            <div className="px-5 py-4">
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                반려 사유를 입력하면 판매자에게 알림이 전송됩니다.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력해주세요 (필수)..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                취소
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectId, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="rounded-full bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                반려
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-96 rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-sm font-bold dark:text-white">상품 정지</h3>
            </div>
            <div className="px-5 py-4">
              <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  정지된 상품은 구매자에게 노출되지 않으며, 판매자에게 알림이 전송됩니다.
                </p>
              </div>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="정지 사유를 입력해주세요 (필수)..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button
                onClick={() => { setSuspendId(null); setSuspendReason(''); }}
                className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                취소
              </button>
              <button
                onClick={() => suspendMutation.mutate({ id: suspendId, reason: suspendReason })}
                disabled={!suspendReason.trim() || suspendMutation.isPending}
                className="rounded-full bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
              >
                정지
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildBreadcrumb(cat: import('@/lib/api/products').CategoryBreadcrumb): string {
  const parts: string[] = [];
  let current: import('@/lib/api/products').CategoryBreadcrumb | null = cat;
  while (current) {
    parts.push(current.name);
    current = current.parent;
  }
  return parts.join(' > ');
}

function StatsCard({ label, value, highlight }: { label: string; value: number; highlight?: string }) {
  const colors: Record<string, string> = {
    yellow: 'ring-2 ring-yellow-400',
    green: '',
    red: '',
    orange: '',
  };
  const ring = highlight ? colors[highlight] || '' : '';

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900 ${ring}`}>
      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold dark:text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium dark:text-gray-200">{value}</p>
    </div>
  );
}

function ActionBtn({ color, onClick, disabled, children }: {
  color: 'green' | 'red' | 'orange' | 'gray';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const colors = {
    green: 'bg-green-600 text-white hover:bg-green-700',
    red: 'bg-red-600 text-white hover:bg-red-700',
    orange: 'bg-orange-600 text-white hover:bg-orange-700',
    gray: 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50 ${colors[color]}`}
    >
      {children}
    </button>
  );
}
