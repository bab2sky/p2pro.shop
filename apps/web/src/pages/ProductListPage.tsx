import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Flame, Clock, Package, ChevronRight, Home, Search, X, SlidersHorizontal, Star, Truck, PackageCheck } from 'lucide-react';
import { getProducts } from '@/lib/api/products';
import { getCategories, type CategoryTree } from '@/lib/api/categories';
import { localizedName } from '@/lib/i18n-helpers';
import { SearchBar } from '@/components/product/SearchBar';
import { ProductGrid } from '@/components/product/ProductGrid';

const PER_PAGE = 20;

export default function ProductListPage() {
  const { t } = useTranslation();
  const SORT_OPTIONS = [
    { key: 'latest', label: t('product.list.sortLatest', '최신순'), icon: Clock },
    { key: 'popular', label: t('product.list.sortPopular', '인기순'), icon: Flame },
    { key: 'price_asc', label: t('product.list.sortPriceAsc', '낮은가격순'), icon: ArrowDownNarrowWide },
    { key: 'price_desc', label: t('product.list.sortPriceDesc', '높은가격순'), icon: ArrowUpNarrowWide },
  ] as const;
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'latest';
  const categoryId = searchParams.get('category_id') || '';
  const condition = searchParams.get('condition') || '';
  const inStock = searchParams.get('in_stock') === 'true';
  const minRating = searchParams.get('min_rating') || '';
  const freeShipping = searchParams.get('free_shipping') === 'true';
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = [condition, inStock, minRating, freeShipping].filter(Boolean).length;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['products', q, sort, categoryId, condition, inStock, minRating, freeShipping],
      queryFn: ({ pageParam = 1 }) =>
        getProducts({
          q: q || undefined,
          sort,
          page: pageParam,
          per_page: PER_PAGE,
          category_id: categoryId || undefined,
          condition: condition || undefined,
          in_stock: inStock || undefined,
          min_rating: minRating ? parseFloat(minRating) : undefined,
          free_shipping: freeShipping || undefined,
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        if (!lastPage.pagination) return undefined;
        const { page, total_pages } = lastPage.pagination;
        return page < total_pages ? page + 1 : undefined;
      },
    });

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const setSort = (s: string) => {
    searchParams.set('sort', s);
    searchParams.delete('page');
    setSearchParams(searchParams);
  };

  const handleSearch = (query: string) => {
    if (query) {
      searchParams.set('q', query);
    } else {
      searchParams.delete('q');
    }
    searchParams.delete('page');
    setSearchParams(searchParams);
  };

  // Fetch categories to resolve category name from ID
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 300_000,
    enabled: !!categoryId,
  });

  // Build breadcrumb path: e.g. [{id, name}, {id, name}, ...]
  const findCategoryPath = (cats: CategoryTree[], id: string, path: { id: string; name: string }[] = []): { id: string; name: string }[] | null => {
    for (const cat of cats) {
      const currentPath = [...path, { id: cat.id, name: localizedName(cat.name, cat.name_en) }];
      if (cat.id === id) return currentPath;
      if (cat.children.length > 0) {
        const found = findCategoryPath(cat.children, id, currentPath);
        if (found) return found;
      }
    }
    return null;
  };

  const categoryPath = categoryId && categories ? findCategoryPath(categories, categoryId) : null;

  const setFilter = (key: string, value: string | null) => {
    if (value) {
      searchParams.set(key, value);
    } else {
      searchParams.delete(key);
    }
    searchParams.delete('page');
    setSearchParams(searchParams);
  };

  const clearAllFilters = () => {
    searchParams.delete('condition');
    searchParams.delete('in_stock');
    searchParams.delete('min_rating');
    searchParams.delete('free_shipping');
    searchParams.delete('page');
    setSearchParams(searchParams);
  };

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const allProducts = data?.pages.flatMap((p) => p.data) ?? [];
  const totalCount = data?.pages[0]?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl -mt-4 sm:-mt-6" role="main" aria-label={t('product.list.ariaLabel', '상품 목록 페이지')}>
      {/* Breadcrumb + Result count */}
      <div className="mb-6 rounded-xl bg-gray-50 px-4 py-2.5 dark:bg-gray-900/60">
        <nav className="flex items-center gap-1.5 text-sm" aria-label="breadcrumb">
          <Link to="/" className="text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
          <Link
            to="/products"
            className={`transition-colors ${
              !categoryPath ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
          >
            {t('product.list.breadcrumbAllProducts', '전체 상품')}
            {!categoryPath && !isLoading && (
              <span className="ml-1 text-gray-400 font-normal dark:text-gray-500">({t('product.list.countSuffix', { count: totalCount, defaultValue: '{{count}}개의 상품' })})</span>
            )}
          </Link>
          {categoryPath?.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
              <Link
                to={`/products?category_id=${crumb.id}`}
                className={`transition-colors ${
                  crumb.id === categoryId
                    ? 'font-semibold text-gray-900 dark:text-white'
                    : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                }`}
              >
                {crumb.name}
                {crumb.id === categoryId && !isLoading && (
                  <span className="ml-1 text-gray-400 font-normal dark:text-gray-500">({t('product.list.countSuffix', { count: totalCount, defaultValue: '{{count}}개의 상품' })})</span>
                )}
              </Link>
            </span>
          ))}
          {q && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
              <span className="font-semibold text-pink-500">&ldquo;{q}&rdquo;</span>
              {!isLoading && (
                <span className="text-gray-400 font-normal dark:text-gray-500">({t('product.list.countSuffix', { count: totalCount, defaultValue: '{{count}}개의 상품' })})</span>
              )}
            </>
          )}
        </nav>
      </div>

      {/* Sort Tabs + Search */}
      <div className="mb-6 mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {SORT_OPTIONS.map((s) => {
            const isActive = sort === s.key;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Desktop: inline search bar */}
        <div className="hidden w-full max-w-[400px] sm:block">
          <SearchBar defaultValue={q} onSearch={handleSearch} />
        </div>

        {/* Mobile: search icon toggle */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 sm:hidden dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label={t('common.search', '검색')}
        >
          {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile: expanded search bar */}
      {mobileSearchOpen && (
        <div className="mb-4 sm:hidden">
          <SearchBar defaultValue={q} onSearch={(query) => { handleSearch(query); setMobileSearchOpen(false); }} />
        </div>
      )}

      {/* Filter Toggle Button */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-all duration-200 ${
            filtersOpen || activeFilterCount > 0
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('product.list.filter.title', '필터')}
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-gray-900 dark:bg-gray-900 dark:text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-[13px] font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            {t('product.list.filter.clear', '초기화')}
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {filtersOpen && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900" role="search" aria-label={t('product.list.ariaSearchFilter', '상품 필터')}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Condition Filter */}
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                <PackageCheck className="mr-1 inline h-3.5 w-3.5" />
                {t('product.list.filter.condition', '상품 상태')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: '', label: t('product.list.filter.all', '전체') },
                  { value: 'new', label: t('product.list.filter.conditionNew', '새상품') },
                  { value: 'used', label: t('product.list.filter.conditionUsed', '중고') },
                  { value: 'refurbished', label: t('product.list.filter.conditionRefurbished', '리퍼') },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter('condition', opt.value || null)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      condition === opt.value
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* In Stock Filter */}
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                <Package className="mr-1 inline h-3.5 w-3.5" />
                {t('product.list.filter.stock', '재고')}
              </label>
              <button
                onClick={() => setFilter('in_stock', inStock ? null : 'true')}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  inStock
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {t('product.list.filter.inStockOnly', '재고 있는 상품만')}
              </button>
            </div>

            {/* Min Rating Filter */}
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                <Star className="mr-1 inline h-3.5 w-3.5" />
                {t('product.list.filter.minRating', '최소 평점')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: '', label: t('product.list.filter.all', '전체') },
                  { value: '3', label: '3+' },
                  { value: '4', label: '4+' },
                  { value: '4.5', label: '4.5+' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter('min_rating', opt.value || null)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      minRating === opt.value
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Free Shipping Filter */}
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                <Truck className="mr-1 inline h-3.5 w-3.5" />
                {t('product.list.filter.shipping', '배송')}
              </label>
              <button
                onClick={() => setFilter('free_shipping', freeShipping ? null : 'true')}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  freeShipping
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {t('product.list.filter.freeShipping', '무료배송만')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-2xl bg-gray-100 dark:bg-gray-800" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-2/3 rounded-full bg-gray-100 dark:bg-gray-800" />
                <div className="h-4 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
                <div className="h-5 w-1/2 rounded-full bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      ) : allProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Package className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {q ? t('product.search.noResults', '검색 결과가 없습니다') : t('product.list.noProducts', '등록된 상품이 없습니다')}
          </p>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">
            {q ? t('product.list.searchTrySuggestion', '다른 검색어로 시도해 보세요') : t('product.list.comingSoon', '곧 새로운 상품이 등록될 예정입니다')}
          </p>
        </div>
      ) : (
        <>
          <div aria-live="polite" aria-atomic="true">
            <ProductGrid products={allProducts} />
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {/* Loading more skeleton */}
          {isFetchingNextPage && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  <div className="mt-3 space-y-2">
                    <div className="h-3 w-2/3 rounded-full bg-gray-100 dark:bg-gray-800" />
                    <div className="h-4 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
                    <div className="h-5 w-1/2 rounded-full bg-gray-100 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* End of list */}
          {!hasNextPage && allProducts.length > 0 && (
            <div className="mt-10 flex items-center justify-center gap-3 py-6">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-[13px] font-medium text-gray-400 dark:text-gray-500">
                {t('product.list.endOfList', '모든 상품을 불러왔습니다')}
              </span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
