import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, Heart, ImageIcon, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductSummary } from '@/lib/api/products';
import { useCompareStore } from '@/stores/compare';

export const ProductCard = React.memo(function ProductCard({ product: p }: { product: ProductSummary }) {
  const { t } = useTranslation();
  // Snaps style: Badge is usually NEW or HOT. Mocking based on id for demo purposes.
  const isNew = Number(p.id) % 2 === 0;
  const { addToCompare, removeFromCompare, isInCompare } = useCompareStore();
  const inCompare = isInCompare(p.id);

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(p.id);
    } else {
      const added = addToCompare(p.id);
      if (!added) {
        toast.warning(t('product.compare.max', '최대 4개까지 비교 가능합니다'));
      }
    }
  };

  return (
    <Link
      to={`/products/${p.id}`}
      role="article"
      aria-label={`${p.title}, ${p.final_price.toLocaleString()} USDT${p.avg_rating ? `, ${t('product.card.rating', '평점')} ${Number(p.avg_rating).toFixed(1)}` : ''}`}
      className="group block text-left transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#F8F9FA] dark:bg-gray-800">
        {p.main_image ? (
          <img
            src={p.main_image}
            alt={p.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-600">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        {/* Snaps Style Badges */}
        <div className="absolute left-3 top-3 flex flex-col gap-1">
          {isNew && (
            <span className="rounded-full bg-[#FF5C8D] px-2 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-sm">
              NEW
            </span>
          )}
        </div>

        {/* Compare toggle button */}
        <button
          onClick={handleCompareToggle}
          className={`absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
            inCompare
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40'
              : 'bg-black/40 text-white opacity-0 backdrop-blur-md group-hover:opacity-100'
          }`}
          aria-label={inCompare ? t('product.compare.remove', '비교 목록에서 제거') : t('product.compare.add', '비교 목록에 추가')}
          title={t('product.compare.button', '비교')}
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>

        {/* Wishlist badge */}
        {p.wishlist_count > 0 && (
          <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white backdrop-blur-md">
            <Heart className="h-3 w-3" fill="currentColor" />
            <span className="font-medium">{p.wishlist_count}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3 flex flex-col gap-1">
        {/* Seller & Rating Row */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-gray-500 sm:text-xs dark:text-gray-400">{p.seller_name}</p>
          {p.avg_rating && (
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
              <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                {Number(p.avg_rating).toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[15px] leading-snug font-bold text-gray-900 line-clamp-2 sm:text-[14px] dark:text-white">
          {p.title}
        </h3>

        {/* Price + Compare */}
        <div className="mt-1 flex items-center justify-between">
          <p className="flex items-baseline gap-1 text-base font-extrabold tracking-tight text-gray-900 sm:text-lg dark:text-white">
            <span className="text-sm font-bold text-gray-400 dark:text-gray-500">USDT</span>
            {p.final_price.toLocaleString()}
          </p>
          <button
            onClick={handleCompareToggle}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
              inCompare
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/40'
                : 'text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-indigo-400'
            }`}
            aria-label={inCompare ? '비교 목록에서 제거' : '비교 목록에 추가'}
            title="비교"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  );
});
