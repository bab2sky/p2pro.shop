import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCategories, type CategoryTree } from '@/lib/api/categories';
import { localizedName } from '@/lib/i18n-helpers';
import { Zap, Grid3X3, Sparkles, Flame, Truck } from 'lucide-react';

// Fallback icons when category has no icon field
const CATEGORY_ICONS = ['🛍️', '👗', '👟', '💄', '🏠', '📱', '🎮', '🍽️', '📚', '⚽'];

// Badge config per index (demo)
const getBadge = (t: (key: string, fallback: string) => string, idx: number) => {
  if (idx === 1) return { text: t('product.freeShipping', '무료배송'), icon: Truck, color: 'bg-purple-500' };
  if (idx === 3 || idx === 4) return { text: 'NEW', icon: Sparkles, color: 'bg-pink-500' };
  if (idx === 5) return { text: 'HOT', icon: Flame, color: 'bg-red-500' };
  return null;
};

export function CategoryNav() {
  const [searchParams] = useSearchParams();
  const activeCategoryId = searchParams.get('category_id');
  const { t } = useTranslation();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 60_000,
  });

  if (!categories || categories.length === 0) return null;

  return (
    <nav className="sticky top-16 z-40 sm:top-20 hidden md:block border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center gap-2 py-3">
          {/* 전체 상품 */}
          <Link
            to="/products"
            className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-bold transition-all ${
              !activeCategoryId
                ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
            {t('common.viewAll', '전체')}
          </Link>

          {/* 구분선 */}
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

          {/* 카테고리 목록 */}
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {categories.map((cat: CategoryTree, idx: number) => {
              const badge = getBadge(t, idx);
              const isActive = activeCategoryId === cat.id;
              const emoji = cat.icon || CATEGORY_ICONS[idx % CATEGORY_ICONS.length];

              return (
                <Link
                  key={cat.id}
                  to={`/products?category_id=${cat.id}`}
                  className={`group relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[15px] font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-[16px]">{emoji}</span>
                  {localizedName(cat.name, cat.name_en)}
                  {badge && (
                    <span className={`${badge.color} ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white`}>
                      {badge.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* 구분선 */}
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

          {/* 타임딜 */}
          <Link
            to="/time-deals"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-2.5 text-[15px] font-extrabold text-white shadow-md shadow-fuchsia-500/20 transition-all hover:shadow-lg hover:shadow-fuchsia-500/30 hover:scale-105 active:scale-95"
          >
            <Zap className="h-4 w-4 fill-white" />
            {t('common.legal.timeDeal', '타임딜')}
          </Link>
        </div>
      </div>
    </nav>
  );
}
