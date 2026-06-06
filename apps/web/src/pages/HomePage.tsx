import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getProducts, type ProductSummary } from '@/lib/api/products';
import { ProductCard } from '@/components/product/ProductCard';
import { BannerSlider } from '@/features/content';
import { HomeSection } from '@/components/home/HomeSection';
import { RecentlyViewed } from '@/components/home/RecentlyViewed';
import PopularKeywords from '@/components/common/PopularKeywords';

export function HomePage() {
  const { t } = useTranslation();
  const { data: latest } = useQuery({
    queryKey: ['products', 'latest-home'],
    queryFn: () => getProducts({ sort: 'latest', per_page: 10 }),
  });

  const { data: popular } = useQuery({
    queryKey: ['products', 'popular-home'],
    queryFn: () => getProducts({ sort: 'popular', per_page: 10 }),
  });

  return (
    <div className="flex flex-col pb-2">
      {/* 1. 컨텐츠 영역 상단 배너 (Mockup 기준 여백 확보 및 라운드 코너) */}
      <section className="mb-6 sm:mb-8">
        <BannerSlider />
      </section>

      {/* 3. 신상품 (Snaps Style) */}
      {latest?.data && latest.data.length > 0 && (
        <section className="w-full bg-white py-6 dark:bg-gray-950 sm:py-8">
          <HomeSection
            title={t('home.section.latestTitle', '주목-! 🙋‍♀️ 신제품 등장')}
            subtitle=""
            linkTo="/products?sort=latest"
            linkText={t('home.section.viewAll', '전체보기')}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-6">
              {latest.data.map((p: ProductSummary) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </HomeSection>
        </section>
      )}

      {/* 4. 인기 상품 (Snaps Style) */}
      {popular?.data && popular.data.length > 0 && (
        <section className="w-full bg-white py-6 dark:bg-gray-950 sm:py-8">
          <HomeSection
            title={t('home.section.popularTitle', '지금 가장 핫한 🔥 베스트 아이템')}
            subtitle=""
            linkTo="/products?sort=popular"
            linkText={t('home.section.more', '더보기')}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-6">
              {popular.data.map((p: ProductSummary) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </HomeSection>
        </section>
      )}

      {/* 5. 인기 검색어 */}
      <section className="bg-white py-4 sm:py-6 dark:bg-gray-950">
        <PopularKeywords />
      </section>

      {/* 6. 최근 본 상품 */}
      <div className="bg-white py-4 sm:py-6">
        <RecentlyViewed />
      </div>
    </div>
  );
}
