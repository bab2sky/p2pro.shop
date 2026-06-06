import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Heart, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api/client';
import type { ProductSummary, Pagination } from '@/lib/api/products';
import { ProductCard } from '@/components/product/ProductCard';
import { toggleWishlist } from '@/lib/api/wishlist';

export default function WishlistPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<ProductSummary | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () =>
      api.get<{ data: ProductSummary[]; pagination: Pagination }>('/wishlist').then((r) => r.data),
  });

  const unwishlistMutation = useMutation({
    mutationFn: (productId: string) => toggleWishlist(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      setConfirmTarget(null);
      toast.success(t('product.wishlistPage.removeSuccess', '찜 목록에서 제거되었습니다.'));
    },
    onError: () => {
      toast.error(t('product.wishlistPage.removeFail', '찜 해제에 실패했습니다.'));
    },
  });

  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">{t('product.wishlistPage.title', '찜 목록')}</h1>
      {(!data?.data || data.data.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Heart className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{t('product.wishlistPage.empty', '찜한 상품이 없습니다.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-5">
          {data.data.map((p: ProductSummary) => (
            <div key={p.id} className="relative">
              <ProductCard product={p} />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmTarget(p);
                }}
                disabled={unwishlistMutation.isPending}
                aria-label={t('product.wishlistPage.removeAria', '찜 해제')}
                title={t('product.wishlistPage.removeAria', '찜 해제')}
                className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur-md transition-colors hover:bg-pink-50 hover:text-pink-500 disabled:opacity-50 dark:bg-gray-900/80 dark:text-gray-200 dark:hover:bg-pink-900/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 찜 해제 확인 모달 */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => e.target === e.currentTarget && !unwishlistMutation.isPending && setConfirmTarget(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-gray-900" role="dialog" aria-modal="true">
            <div className="mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">{t('product.wishlistPage.confirmTitle', '찜 해제')}</h3>
            </div>
            <p className="mb-1 text-[13px] text-gray-700 dark:text-gray-300">
              <strong className="font-semibold text-gray-900 dark:text-white">{confirmTarget.title}</strong>
            </p>
            <p className="mb-5 text-[13px] text-gray-500 dark:text-gray-400">
              {t('product.wishlistPage.confirmMessage', '이 상품을 찜 목록에서 제거하시겠습니까?')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={unwishlistMutation.isPending}
                className="rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {t('common.cancel', '취소')}
              </button>
              <button
                type="button"
                onClick={() => unwishlistMutation.mutate(confirmTarget.id)}
                disabled={unwishlistMutation.isPending}
                className="rounded-full bg-pink-500 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-pink-600 disabled:opacity-50"
              >
                {unwishlistMutation.isPending ? t('product.wishlistPage.removing', '제거 중...') : t('product.wishlistPage.remove', '제거')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
