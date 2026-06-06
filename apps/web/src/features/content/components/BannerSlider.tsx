import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Zap, Clock, Store, ArrowRight } from 'lucide-react';
import { getBanners, type Banner } from '@/lib/api/content';

const FALLBACK_BANNERS: Banner[] = [
  {
    id: '-0',
    title: '타임딜 - 지금 이 순간, 놓치면 후회할 특가!',
    image_url: '/banners/time-deal.svg',
    link_url: '/time-deals',
    is_active: true,
    sort_order: 0,
    position: 'main',
    starts_at: new Date().toISOString(),
    ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '-1',
    title: '판매자 입점 신청',
    image_url: '/banners/seller-apply.svg',
    link_url: '/seller/apply',
    is_active: true,
    sort_order: 1,
    position: 'main',
    starts_at: new Date().toISOString(),
    ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function BannerSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data } = useQuery({
    queryKey: ['banners'],
    queryFn: () => getBanners(),
  });

  const apiBanners: Banner[] = data?.data ?? [];
  const banners = apiBanners.length > 0 ? apiBanners : FALLBACK_BANNERS;

  const nextSlide = useCallback(() => {
    if (banners.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = () => {
    if (banners.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [banners.length, nextSlide]);

  if (banners.length === 0) return null;

  const current = banners[currentIndex];

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm">
      <a
        href={current.link_url || '#'}
        className="block"
        onClick={(e) => {
          if (!current.link_url) e.preventDefault();
        }}
      >
        <img
          src={current.image_url}
          alt={current.title}
          className="h-[200px] w-full object-cover sm:h-[280px] md:h-[360px]"
        />

        {/* Time Deal banner — HTML text overlay */}
        {current.id === '-0' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full px-6 sm:px-10 md:px-14">
              <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm sm:text-xs">
                    <Clock className="h-3 w-3" />
                    LIMITED TIME
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl">
                  <span className="flex items-center gap-2 sm:gap-3">
                    <Zap className="h-7 w-7 fill-amber-400 text-amber-400 sm:h-10 sm:w-10" />
                    TIME DEAL
                  </span>
                </h3>
                <p className="text-sm font-medium text-white/90 drop-shadow sm:text-base md:text-lg">
                  지금 이 순간, 놓치면 후회할 특가!
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-extrabold text-gray-900 shadow-lg sm:text-sm">
                    UP TO 70% OFF
                  </span>
                  <span className="rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-sm sm:text-sm">
                    바로가기 &rarr;
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : current.id === '-1' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full px-6 sm:px-10 md:px-14">
              <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-cyan-400/20 px-3 py-1 text-[11px] font-bold text-cyan-300 backdrop-blur-sm sm:text-xs">
                    <Store className="h-3 w-3" />
                    SELLER
                  </span>
                </div>
                <h3 className="text-xl font-black tracking-tight text-white drop-shadow-lg sm:text-3xl md:text-4xl">
                  판매자 입점 신청
                </h3>
                <p className="text-sm font-medium text-white/90 drop-shadow sm:text-base md:text-lg">
                  P2PRO에서 글로벌 셀러로 성장하세요
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="rounded-full bg-cyan-400 px-4 py-1.5 text-xs font-extrabold text-gray-900 shadow-lg sm:text-sm">
                    수수료 0% 프로모션
                  </span>
                  <span className="flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-sm sm:text-sm">
                    신청하기
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 sm:p-6">
            <h3 className="text-base font-bold text-white sm:text-lg md:text-xl">{current.title}</h3>
          </div>
        )}
      </a>

      {banners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow-md backdrop-blur-sm hover:bg-white sm:left-4 sm:p-2"
            aria-label="이전 배너"
          >
            <ChevronLeft className="h-4 w-4 text-gray-700 sm:h-5 sm:w-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow-md backdrop-blur-sm hover:bg-white sm:right-4 sm:p-2"
            aria-label="다음 배너"
          >
            <ChevronRight className="h-4 w-4 text-gray-700 sm:h-5 sm:w-5" />
          </button>

          {/* Page indicator bars (Snaps style) */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 z-10">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === idx ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                aria-label={`배너 ${idx + 1} 이동`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
