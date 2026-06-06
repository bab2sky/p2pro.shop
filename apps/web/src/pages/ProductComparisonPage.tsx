import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';
import { Star, Trash2, ShoppingCart, BarChart3, ImageIcon, ArrowLeft } from 'lucide-react';
import { useCompareStore } from '@/stores/compare';
import { useCartStore } from '@/stores/cart';
import { getProduct, type ProductDetail } from '@/lib/api/products';
import { toast } from 'sonner';
import { localizedName } from '@/lib/i18n-helpers';

type CategoryNode = NonNullable<ProductDetail['category']>;

function getCategoryName(cat: ProductDetail['category']): string {
  if (!cat) return '-';
  const parts: string[] = [];
  let current: CategoryNode | null = cat;
  while (current) {
    parts.unshift(localizedName(current.name, (current as { name_en?: string | null }).name_en));
    current = (current.parent as CategoryNode | null) ?? null;
  }
  return parts.join(' > ');
}

function StockBadge({ stock }: { stock: number }) {
  const { t } = useTranslation();
  if (stock > 10) {
    return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('product.comparePage.stockOk', '재고 있음')}</span>;
  }
  if (stock > 0) {
    return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('product.comparePage.stockLow', { count: stock, defaultValue: '{{count}}개 남음' })}</span>;
  }
  return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('product.comparePage.soldOut', '품절')}</span>;
}

export default function ProductComparisonPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { compareItems, removeFromCompare, clearCompare } = useCompareStore();
  const addCartItem = useCartStore((s) => s.addItem);

  const queries = useQueries({
    queries: compareItems.map((id) => ({
      queryKey: ['product', id],
      queryFn: () => getProduct(id),
      staleTime: 60_000,
    })),
  });

  const products = queries
    .map((q) => q.data)
    .filter((d): d is ProductDetail => !!d);

  const isLoading = queries.some((q) => q.isLoading);
  const failedIds = queries
    .map((q, i) => (q.isError ? compareItems[i] : null))
    .filter((id): id is string => id !== null);

  // Find the lowest price for highlighting
  const prices = products.map((p) => Number(p.final_price));
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;

  const handleAddToCart = (p: ProductDetail) => {
    addCartItem({
      product_id: p.id,
      quantity: 1,
      title: p.title,
      price: p.final_price,
      image: p.images.find((i) => i.is_main)?.image_url ?? p.images[0]?.image_url,
    });
    toast.success(t('product.comparePage.addToCart', '장바구니에 추가되었습니다'));
  };

  const handleRemove = (id: string) => {
    removeFromCompare(id);
  };

  // Empty state
  if (compareItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <BarChart3 className="h-16 w-16 text-gray-300 dark:text-gray-600" />
        <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{t('product.comparePage.title', '상품 비교')}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('product.comparePage.emptyMessage', '비교할 상품을 추가해주세요')}</p>
        <Link
          to="/products"
          className="mt-6 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {t('product.comparePage.browseProducts', '상품 둘러보기')}
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t('product.comparePage.back', '뒤로 가기')}
          >
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('product.comparePage.title', '상품 비교')} <span className="text-base font-medium text-gray-400">({compareItems.length}/4)</span>
          </h1>
        </div>
        <button
          onClick={clearCompare}
          className="rounded-full px-4 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {t('product.comparePage.clearAll', '전체 초기화')}
        </button>
      </div>

      {failedIds.length > 0 && !isLoading && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="mt-0.5 shrink-0 text-base">⚠️</span>
          <span>
            {t('product.comparePage.loadFailed', { count: failedIds.length, defaultValue: '{{count}}개 상품을 불러오지 못했습니다. 상품이 삭제되었거나 일시적인 오류일 수 있습니다.' })}{' '}
            <button
              onClick={() => failedIds.forEach(removeFromCompare)}
              className="font-bold underline underline-offset-2"
            >
              {t('product.comparePage.removeFailed', '실패한 상품 제거')}
            </button>
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-500" role="status" aria-label={t('product.comparePage.ariaLoading', '로딩 중')}>
          {t('product.comparePage.loading', '상품 정보를 불러오는 중...')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="w-32 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.header', '항목')}
                </th>
                {products.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleRemove(p.id)}
                      className="mx-auto flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      aria-label={t('product.comparePage.removeFromCompare', { title: p.title, defaultValue: '{{title}} 비교에서 제거' })}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('product.comparePage.removeShort', '제거')}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* Image Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.image', '이미지')}
                </td>
                {products.map((p) => {
                  const mainImg = p.images.find((i) => i.is_main)?.image_url ?? p.images[0]?.image_url;
                  return (
                    <td key={p.id} className="px-4 py-3 text-center">
                      <Link to={`/products/${p.id}`} className="mx-auto block w-fit">
                        {mainImg ? (
                          <img
                            src={mainImg}
                            alt={p.title}
                            className="mx-auto h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28"
                          />
                        ) : (
                          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-xl bg-gray-100 text-gray-300 sm:h-28 sm:w-28 dark:bg-gray-800 dark:text-gray-600">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>

              {/* Title Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.name', '상품명')}
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    <Link
                      to={`/products/${p.id}`}
                      className="text-sm font-semibold text-gray-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                    >
                      {p.title}
                    </Link>
                  </td>
                ))}
              </tr>

              {/* Price Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.price', '가격')}
                </td>
                {products.map((p) => {
                  const price = Number(p.final_price);
                  const isLowest = price === lowestPrice && products.length > 1;
                  return (
                    <td key={p.id} className="px-4 py-3 text-center">
                      <span
                        className={`text-base font-extrabold ${
                          isLowest
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {price.toLocaleString()}{' '}
                        <span className="text-xs font-bold text-gray-400">USDT</span>
                      </span>
                      {isLowest && (
                        <span className="mt-1 block text-[10px] font-bold text-indigo-500">{t('product.comparePage.row.lowestPrice', '최저가')}</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Seller Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.seller', '판매자')}
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    <Link
                      to={`/sellers/${p.seller_id}`}
                      className="text-sm font-medium text-gray-700 transition-colors hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
                    >
                      {p.seller_name}
                    </Link>
                  </td>
                ))}
              </tr>

              {/* Rating Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.rating', '평점')}
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    {p.avg_rating ? (
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 text-amber-400" fill="currentColor" />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {Number(p.avg_rating).toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{t('product.comparePage.row.noRating', '평점 없음')}</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Review Count Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.reviewCount', '리뷰 수')}
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                    {t('product.comparePage.row.reviewUnit', { count: p.review_count, defaultValue: '{{count}}건' })}
                  </td>
                ))}
              </tr>

              {/* Stock Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.stockStatus', '재고 상태')}
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    <StockBadge stock={p.stock} />
                  </td>
                ))}
              </tr>

              {/* Shipping Fee Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.shipping', '배송비')}
                </td>
                {products.map((p) => {
                  const fee = Number(p.shipping_fee);
                  return (
                    <td key={p.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                      {fee === 0 ? (
                        <span className="font-semibold text-green-600 dark:text-green-400">{t('product.detail.freeShipping', '무료배송')}</span>
                      ) : (
                        <span>{fee.toLocaleString()} USDT</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Category Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {t('product.comparePage.row.category', '카테고리')}
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                    {getCategoryName(p.category)}
                  </td>
                ))}
              </tr>

              {/* Add to Cart Row */}
              <tr>
                <td className="bg-gray-50 px-4 py-3 dark:bg-gray-800/50" />
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleAddToCart(p)}
                      disabled={p.stock === 0}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {t('product.detail.addToCart', '장바구니 담기')}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
