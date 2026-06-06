import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CategoryTree } from '@/lib/api/categories';
import { localizedName } from '@/lib/i18n-helpers';

interface CategoryIconBarProps {
  categories: CategoryTree[];
}

// Helper to generate fake Snaps style badges for demo purposes
const getBadge = (idx: number) => {
  if (idx === 1) return { text: '무료배송', color: 'bg-purple-500' };
  if (idx === 3 || idx === 4) return { text: 'NEW', color: 'bg-[#FF5C8D]' };
  if (idx === 5) return { text: 'HOT', color: 'bg-red-500' };
  return null;
};

export function CategoryIconBar({ categories }: CategoryIconBarProps) {
  const { t } = useTranslation('product');
  return (
    <div className="flex w-full items-end gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide sm:gap-10 sm:justify-center px-4 pb-2 pt-6">
      <Link
        to="/products"
        className="relative pb-2 text-base font-extrabold text-gray-900 hover:text-black sm:text-sm dark:text-gray-100"
      >
        {t('list.title', '전체 상품')}
      </Link>
      <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
      {categories.map((cat, idx) => {
        const badge = getBadge(idx);
        return (
          <Link
            key={cat.id}
            to={`/products?category_id=${cat.id}`}
            className="relative flex flex-col items-center justify-end pb-2"
          >
            {/* Floating Badge (Snaps Style) */}
            {badge && (
              <div className="absolute -top-6 left-1/2 flex -translate-x-1/2 flex-col items-center animate-bounce duration-[2000ms]">
                <span className={`rounded-full ${badge.color} px-2 py-0.5 text-[0.6rem] font-bold text-white shadow-sm`}>
                  {badge.text}
                </span>
                {/* Speech Bubble Tail */}
                <div className={`-mt-[1px] h-1.5 w-1.5 rotate-45 ${badge.color}`} />
              </div>
            )}
            <span className="text-base font-extrabold text-gray-900 transition-colors hover:text-black sm:text-sm dark:text-gray-100">
              {localizedName(cat.name, cat.name_en)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
