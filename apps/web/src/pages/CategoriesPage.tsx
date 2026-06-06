import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { getCategories, type CategoryTree } from '@/lib/api/categories';
import { localizedName } from '@/lib/i18n-helpers';

function CategoryItem({ category }: { category: CategoryTree }) {
  return (
    <li>
      <Link
        to={`/categories/${category.id}`}
        className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-3.5 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        {category.icon && <span className="text-xl">{category.icon}</span>}
        <span className="flex-1 text-[14px] font-bold text-gray-900 dark:text-white">{localizedName(category.name, category.name_en)}</span>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </Link>
      {category.children.length > 0 && (
        <ul className="ml-6 mt-2 space-y-2">
          {category.children.map((child) => (
            <CategoryItem key={child.id} category={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
        <LayoutGrid className="h-5 w-5" />
        {t('nav.categories')}
      </h1>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : !categories?.length ? (
        <div className="flex flex-col items-center py-16">
          <LayoutGrid className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-[13px] font-bold text-gray-400">{t('common.noData')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {categories.map((cat) => (
            <CategoryItem key={cat.id} category={cat} />
          ))}
        </ul>
      )}
    </div>
  );
}
