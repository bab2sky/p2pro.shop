import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Search, ArrowLeft } from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { HeaderActions } from './HeaderActions';

export function Header() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileSearchOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-950" role="banner">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 sm:h-20">
          {/* Left: Hamburger (mobile) + Logo */}
          <div className="flex shrink-0 items-center gap-3 lg:w-[240px]">
            {isHome ? (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 md:hidden dark:text-gray-100 dark:hover:bg-gray-800"
                aria-label={t('common.menu.menuOpen', '메뉴 열기')}
              >
                <Menu className="h-[22px] w-[22px] stroke-[1.5]" />
              </button>
            ) : (
              <button
                onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
                className="rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 md:hidden dark:text-gray-100 dark:hover:bg-gray-800"
                aria-label={t('common.menu.back', '뒤로가기')}
              >
                <ArrowLeft className="h-[22px] w-[22px] stroke-[1.5]" />
              </button>
            )}
            <Link to="/" aria-label={t('common.menu.homeNav', 'P2PRO 홈으로 이동')} className="text-[24px] font-black tracking-tighter text-gray-900 sm:text-[28px] dark:text-white">
              P2PRO<span className="text-pink-500">.</span>
            </Link>
          </div>

          {/* Center: Search Bar (desktop) */}
          <div className="hidden flex-1 justify-center md:flex px-4">
            <form onSubmit={handleSearch} className="relative w-full max-w-[560px]" role="search" aria-label={t('common.menu.productSearch', '상품 검색')}>
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 stroke-[1.5]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('common.menu.searchPlaceholderBrand', '브랜드, 상품, 태그 등 검색')}
                placeholder={t('common.menu.searchPlaceholderBrand', '브랜드, 상품, 태그 등 검색')}
                className="h-12 w-full rounded-full bg-gray-100/60 pl-12 pr-4 text-[15px] font-medium transition-colors placeholder:text-gray-400 focus:bg-gray-100 focus:outline-none focus:ring-0 dark:bg-gray-800/60 dark:text-gray-100 dark:focus:bg-gray-800"
              />
            </form>
          </div>

          {/* Right: Actions */}
          <div className="flex shrink-0 justify-end lg:w-[320px]">
            <HeaderActions onMobileSearchToggle={() => setMobileSearchOpen(!mobileSearchOpen)} />
          </div>
        </div>

        {/* Mobile Search Overlay */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${mobileSearchOpen ? 'max-h-20 border-t border-gray-100 opacity-100 dark:border-gray-800' : 'max-h-0 opacity-0'
            }`}
        >
          <div className="px-4 py-3 bg-white dark:bg-gray-950">
            <form onSubmit={handleSearch} className="relative" role="search" aria-label={t('common.menu.mobileProductSearch', '모바일 상품 검색')}>
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('common.menu.searchPlaceholder', '어떤 상품을 찾으시나요?')}
                placeholder={t('common.menu.searchPlaceholder', '어떤 상품을 찾으시나요?')}
                className="h-10 w-full rounded-full bg-gray-100 pl-11 pr-4 text-[14px] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900 dark:bg-gray-800 dark:text-gray-100"
              />
            </form>
          </div>
        </div>
      </header>
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
