import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sanitizeHtml } from '@/lib/sanitize';
import { getProduct, type ProductOption } from '@/lib/api/products';
import { addToCart } from '@/lib/api/cart';
import { useAuthStore } from '@/stores/auth';
import { ProductImageGallery } from '@/components/product/ProductImageGallery';
import { ProductOptionSelector } from '@/components/product/ProductOptionSelector';
import { ReviewSection } from '@/features/reviews';
import { QnaSection } from '@/features/qna';
import { ShareButton } from '@/components/product/ShareButton';
import { confirmAction } from '@/lib/confirm';
import { recordProductView } from '@/lib/api/bulk';
import { toggleWishlist } from '@/lib/api/wishlist';
import { Heart, ShoppingCart, MessageCircle } from 'lucide-react';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { RecentlyViewed } from '@/components/home/RecentlyViewed';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

export default function ProductDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = !!useAuthStore((s) => s.accessToken);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const initialTabFromHash = (() => {
    const hash = location.hash.replace('#', '');
    if (hash === 'review' || hash === 'qna' || hash === 'return') return hash;
    return 'detail' as const;
  })();
  const [activeTab, setActiveTab] = useState<'detail' | 'review' | 'qna' | 'return'>(initialTabFromHash);

  // URL 해시가 바뀌면 (예: 다른 페이지에서 #qna 로 진입) 해당 탭 활성화 + 스크롤
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash === 'qna' || hash === 'review' || hash === 'return' || hash === 'detail') {
      setActiveTab(hash);
      setTimeout(() => {
        const target = document.getElementById(`${hash}-section`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [location.hash]);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id!),
    enabled: !!id,
  });

  // 최근 본 상품 기록
  const { addItem: addRecentlyViewed } = useRecentlyViewed();
  useEffect(() => {
    if (id) addRecentlyViewed(id);
  }, [id, addRecentlyViewed]);

  // 조회수 기록
  useEffect(() => {
    if (id) recordProductView(id).catch(() => { });
  }, [id]);

  const [isWishlisted, setIsWishlisted] = useState(false);
  useEffect(() => {
    if (product) setIsWishlisted(product.is_wishlisted);
  }, [product]);

  const queryClient = useQueryClient();
  const wishlistMutation = useMutation({
    mutationFn: () => toggleWishlist(id!),
    onSuccess: (res) => {
      setIsWishlisted(res.wishlisted);
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  const cartMutation = useMutation({
    mutationFn: () =>
      addToCart({
        product_id: id!,
        option_id: selectedOption || undefined,
        quantity,
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      if (await confirmAction(t('product.detail.addedToCartGoCart', '장바구니에 담았습니다. 장바구니로 이동하시겠습니까?'))) {
        navigate('/cart');
      }
    },
  });

  if (isLoading) return <div className="text-center py-12">{t('common.loading', 'Loading...')}</div>;
  if (!product) return <div className="text-center py-12">{t('product.detail.notFound', '상품을 찾을 수 없습니다.')}</div>;

  const selectedOpt = product.options.find((o: ProductOption) => o.id === selectedOption);
  const unitPrice = Number(product.final_price) + (selectedOpt ? Number(selectedOpt.additional_price) : 0);
  const totalPrice = unitPrice * quantity;

  return (
    <div className="mx-auto w-full max-w-7xl py-4 md:py-6" role="main" aria-label={t('product.detail.ariaPage', '상품 상세 페이지')}>
      <div className="flex flex-col gap-10 md:flex-row md:items-start lg:gap-16">
        {/* Left: Image Gallery (Sticky on desktop) */}
        <div className="w-full md:sticky md:top-28 md:w-[50%] lg:w-[55%]">
          <div className="overflow-hidden rounded-2xl bg-[#F8F9FA]">
            <ProductImageGallery images={product.images} title={product.title} />
          </div>
        </div>

        {/* Right: Product Info */}
        <div className="flex w-full flex-col md:w-[50%] lg:w-[45%]">
          {/* Share & Badge Row */}
          <div className="mb-3 flex flex-row-reverse items-start justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (!isLoggedIn) return navigate('/login');
                  wishlistMutation.mutate();
                }}
                disabled={wishlistMutation.isPending}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-pink-500 disabled:opacity-50 dark:hover:bg-gray-800"
                aria-label={t('product.detail.wishlistAria', '찜하기')}
              >
                <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-pink-500 text-pink-500' : ''}`} />
              </button>
              <ShareButton />
            </div>
            <span className="rounded-full bg-pink-500 px-2.5 py-1 text-[11px] font-bold tracking-wider text-white shadow-sm">
              NEW
            </span>
          </div>

          <h1 className="mb-3 text-2xl font-black leading-tight text-gray-900 sm:text-3xl lg:text-[32px]">
            {product.title}
          </h1>

          <div className="mb-6 flex items-center gap-2 text-[14px]">
            <span className="font-bold text-pink-500">· {t('product.detail.reviewSummary', { count: product.review_count || 0, defaultValue: '리뷰 ({{count}}개)' })}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              {t('product.detail.sellerLabel', '판매자')}:{' '}
              <Link to={`/sellers/${product.seller_id}`} className="font-bold text-gray-900 hover:underline">
                {product.seller_name}
              </Link>
            </span>
            {product.avg_rating && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-amber-500">★ {Number(product.avg_rating).toFixed(1)}</span>
              </>
            )}
          </div>

          <div className="mb-4 border-y border-gray-100 py-4">
            <div className="flex items-end gap-2 text-gray-900">
              <p className="text-2xl font-extrabold sm:text-3xl">
                {Number(product.final_price).toLocaleString()}
                <span className="ml-1 text-base font-bold text-gray-900">USDT</span>
              </p>
            </div>

            <div className="mt-3 flex flex-col gap-1.5 text-sm text-gray-600">
              <div className="flex items-center gap-4">
                <span className="w-16 font-medium text-gray-400">{t('product.detail.shippingFeeLabel', '배송료')}</span>
                {Number(product.shipping_fee) > 0 ? (
                  <span>{Number(product.shipping_fee).toLocaleString()} USDT</span>
                ) : (
                  <span className="font-bold text-purple-600">{t('product.detail.freeShipping', '무료배송')}</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="w-16 font-medium text-gray-400">{t('product.detail.surchargeLabel', '도서산간')}</span>
                <span className="text-gray-500">{t('product.detail.surchargeDesc', '일부 지역 추가 배송비 발생')}</span>
              </div>
            </div>
          </div>

          {/* Options (Snaps style box) */}
          <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <ProductOptionSelector
              options={product.options}
              selectedId={selectedOption}
              onChange={setSelectedOption}
            />
          </div>

          {/* Quantity (Snaps style box) */}
          <div className="mb-2 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
            <span className="text-[14px] font-bold text-gray-900">{t('product.detail.quantity', '수량')}</span>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label={t('product.detail.qtyDecrease', '수량 감소')}
                className="flex h-9 w-9 items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-100"
              >
                -
              </button>
              <div className="flex h-9 w-12 items-center justify-center border-x border-gray-200 text-sm font-bold text-gray-900">
                {quantity}
              </div>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                aria-label={t('product.detail.qtyIncrease', '수량 증가')}
                className="flex h-9 w-9 items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Total Price Section */}
          <div className="mb-6 mt-4 flex items-end justify-between border-t-2 border-gray-900 pt-4">
            <span className="text-[15px] font-bold text-gray-900">{t('product.detail.totalPrice', '총 금액')}</span>
            <div className="text-right">
              <span className="text-[26px] font-black leading-none text-pink-600 sm:text-[30px]">
                {totalPrice.toLocaleString()}
              </span>
              <span className="ml-1 text-base font-bold text-gray-900">USDT</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (!isLoggedIn) return navigate('/login');
                cartMutation.mutate();
              }}
              disabled={cartMutation.isPending}
              aria-label={t('product.detail.addToCartAria', '장바구니 담기')}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-4 text-[15px] font-bold text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              <ShoppingCart className="h-5 w-5" />
              {t('product.detail.addToCart', '장바구니 담기')}
            </button>
            <button
              onClick={() => {
                if (!isLoggedIn) return navigate('/login');
                navigate('/checkout', {
                  state: {
                    items: [{ product_id: id, option_id: selectedOption, quantity }],
                  },
                });
              }}
              aria-label={t('product.detail.buyNowAria', '바로 구매하기')}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 text-[15px] font-extrabold text-white transition-transform hover:scale-[1.02] hover:bg-black"
            >
              {t('product.detail.buyNowText', '바로 구매하기')}
            </button>
          </div>

          {/* 판매자에게 문의 */}
          <button
            onClick={() => {
              setActiveTab('qna');
              setTimeout(() => {
                document.getElementById('qna-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-pink-50 py-3.5 text-[14px] font-bold text-pink-600 transition-colors hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-900/20 dark:text-pink-400 dark:hover:bg-pink-900/30"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            {t('product.detail.sellerInquiry', '판매자에게 문의')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-10">
        <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-900" role="tablist" aria-label={t('product.detail.tabsAria', '상품 정보 탭')}>
          {[
            { key: 'detail', label: t('product.detail.tab.detail', '상세정보') },
            { key: 'review', label: `${t('product.detail.tab.review', '리뷰')} (${product.review_count || 0})` },
            { key: 'qna', label: t('product.qna', 'Q&A') },
            { key: 'return', label: t('product.detail.tab.return', '반품정책') },
          ].map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 rounded-xl py-2.5 text-center text-[17px] font-semibold transition-all sm:text-[18px] ${
                activeTab === tab.key
                  ? 'bg-white text-black shadow-sm dark:bg-gray-800 dark:text-white'
                  : 'text-black hover:bg-gray-50 dark:text-white dark:hover:bg-gray-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="py-6">
          {activeTab === 'detail' && (
            product.description ? (
              <div
                className="prose max-w-none dark:prose-invert prose-img:rounded-xl"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
              />
            ) : (
              <p className="py-8 text-center text-gray-400">상세 설명이 없습니다.</p>
            )
          )}
          {activeTab === 'review' && (
            <ReviewSection productId={id!} />
          )}
          {activeTab === 'qna' && (
            <div id="qna-section">
              <QnaSection productId={id!} sellerId={product?.seller_id} />
            </div>
          )}
          {activeTab === 'return' && (
            product.return_policy ? (
              <div
                className="prose max-w-none dark:prose-invert prose-img:rounded-xl"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.return_policy) }}
              />
            ) : (
              <p className="py-8 text-center text-gray-400">반품 정책 정보가 없습니다.</p>
            )
          )}
        </div>
      </div>

      {/* Related Products */}
      {product.category && (
        <RelatedProducts productId={id!} categoryId={product.category.id} />
      )}

      {/* Recently Viewed */}
      <div className="mt-10">
        <RecentlyViewed />
      </div>
    </div>
  );
}
