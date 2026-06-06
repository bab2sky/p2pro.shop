import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getRelatedProducts } from '@/lib/api/products';
import { ProductCard } from '@/components/product/ProductCard';

interface RelatedProductsProps {
  productId: string;
  categoryId: string;
}

export function RelatedProducts({ productId, categoryId }: RelatedProductsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', 'related', productId, categoryId],
    queryFn: () => getRelatedProducts(productId),
    enabled: !!productId,
    staleTime: 60_000,
  });

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 220;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (isLoading) {
    return (
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">관련 상품</h2>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[200px]">
              <div className="aspect-square animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-5 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">관련 상품</h2>
        <div className="hidden gap-1 md:flex">
          <button
            onClick={() => scroll('left')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="이전 상품 보기"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="다음 상품 보기"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
      >
        {products.map((p) => (
          <div key={p.id} className="min-w-[200px] max-w-[200px]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
