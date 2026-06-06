import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { getCategories, getCategoryProducts } from '@/lib/api/categories';
import { ProductGrid } from '@/components/product/ProductGrid';

export default function CategoryProductsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['category-products', id],
    queryFn: () => getCategoryProducts(id!, { per_page: 40 }),
    enabled: !!id,
  });

  const findCategory = (cats: typeof categories, targetId: string): string | undefined => {
    if (!cats) return undefined;
    for (const cat of cats) {
      if (cat.id === targetId) return cat.name;
      const found = findCategory(cat.children, targetId);
      if (found) return found;
    }
    return undefined;
  };

  const categoryName = findCategory(categories, id || '') || t('nav.categories');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">{categoryName}</h1>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-3/4 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-1/2 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : !data?.data?.length ? (
        <div className="flex flex-col items-center py-16">
          <Package className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-[13px] font-bold text-gray-400">{t('common.noData')}</p>
        </div>
      ) : (
        <ProductGrid products={data.data} />
      )}
    </div>
  );
}
