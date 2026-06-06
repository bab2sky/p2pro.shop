import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { ProductCard } from '@/components/product/ProductCard';
import api from '@/lib/api/client';
import type { ProductSummary, ProductDetail } from '@/lib/api/products';

export function RecentlyViewed() {
  const { t } = useTranslation('product');
  const { items } = useRecentlyViewed();

  const { data: products } = useQuery({
    queryKey: ['products', 'recently-viewed', items.slice(0, 8)],
    queryFn: async () => {
      if (items.length === 0) return [];
      const ids = items.slice(0, 8);
      const results = await Promise.all(
        ids.map((id) =>
          api
            .get<{ data: ProductDetail }>(`/products/${id}`)
            .then((r) => {
              const d = r.data.data;
              const main = d.images?.find((i) => i.is_main)?.image_url ?? d.images?.[0]?.image_url ?? null;
              const summary: ProductSummary = {
                id: d.id,
                title: d.title,
                final_price: d.final_price,
                shipping_fee: d.shipping_fee,
                main_image: main,
                seller_name: d.seller_name,
                category_name: d.category?.name ?? '',
                stock: d.stock,
                sold_count: d.sold_count,
                wishlist_count: d.wishlist_count,
                avg_rating: d.avg_rating ?? '',
                review_count: d.review_count,
                status: d.status,
                rejected_reason: null,
                created_at: d.created_at,
              };
              return summary;
            })
            .catch(() => null),
        ),
      );
      return results.filter(Boolean) as ProductSummary[];
    },
    enabled: items.length > 0,
    staleTime: 5 * 60_000,
  });

  if (!products || products.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-4">{t('recentlyViewed')}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((p) => (
          <div key={p.id} className="min-w-[200px] max-w-[200px]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
