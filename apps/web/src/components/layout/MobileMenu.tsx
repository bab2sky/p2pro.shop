import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  X, Search, Home, Package, ShoppingCart,
  Heart, ClipboardList, Ticket, Store,
  LogOut, Shield, Zap, User, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ThemeToggle } from '@/features/theme';
import { getCategories, type CategoryTree } from '@/lib/api/categories';
import { localizedName } from '@/lib/i18n-helpers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 300_000,
  });

  // Close on route change
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      onClose();
    }
  }, [location.pathname, onClose]);

  // Escape + focus trap
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const els = Array.from(menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (els.length) els[0].focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !els.length) return;
      const idx = els.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (idx <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      } else {
        if (idx === els.length - 1) { e.preventDefault(); els[0].focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      onClose();
    }
  };

  const initial = user
    ? (user.nickname || user.email).charAt(0).toUpperCase()
    : '';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <nav
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-gray-950 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4">
          <Link to="/" className="text-[20px] font-black tracking-tighter text-gray-900 dark:text-white">
            P2PRO<span className="text-pink-500">.</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label={t('common.menu.menuClose', '메뉴 닫기')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── User Card ── */}
        {user ? (
          <Link to="/my" className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3.5 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white dark:bg-white dark:text-gray-900">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-gray-900 dark:text-white">
                {user.nickname || user.email}
              </p>
              <p className="truncate text-[13px] text-gray-400">{user.email}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
          </Link>
        ) : (
          <div className="mx-4 mb-3 flex gap-2">
            <Link
              to="/login"
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-center text-[15px] font-bold text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
            >
              {t('common.login', '로그인')}
            </Link>
            <Link
              to="/register"
              className="flex-1 rounded-xl bg-gray-900 py-2.5 text-center text-[15px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {t('common.register', '회원가입')}
            </Link>
          </div>
        )}

        {/* ── Search ── */}
        <div className="px-4 pb-3">
          <form onSubmit={handleSearch} className="relative" role="search" aria-label={t('common.menu.searchAriaLabel', '모바일 메뉴 검색')}>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('common.menu.searchPlaceholder', '어떤 상품을 찾으시나요?')}
              placeholder={t('common.menu.searchPlaceholder', '어떤 상품을 찾으시나요?')}
              className="w-full rounded-xl bg-gray-100 py-2.5 pl-10 pr-4 text-[13px] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-gray-600"
            />
          </form>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Quick Links */}
          <div className="grid grid-cols-4 gap-1 px-4 py-3">
            <QuickLink to="/" icon={<Home className="h-5 w-5" />} label={t('common.home', '홈')} />
            <QuickLink to="/products" icon={<Package className="h-5 w-5" />} label={t('common.menu.allProducts', '전체상품')} />
            <QuickLink to="/cart" icon={<ShoppingCart className="h-5 w-5" />} label={t('common.cart', '장바구니')} />
            <QuickLink to="/my/wishlist" icon={<Heart className="h-5 w-5" />} label={t('common.menu.wishlistShort', '찜')} />
          </div>

          {/* 타임딜 배너 */}
          <div className="px-4 pb-2">
            <Link
              to="/time-deals"
              className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-4 py-3 shadow-md shadow-fuchsia-500/20 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <Zap className="h-5 w-5 fill-white text-white" />
                <div>
                  <p className="text-[15px] font-extrabold text-white">{t('common.legal.timeDeal', '타임딜')}</p>
                  <p className="text-[12px] text-white/70">{t('common.menu.timeDealSubtitle', '한정 특가 진행중')}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/60" />
            </Link>
          </div>

          {/* 카테고리 */}
          <div className="px-4 py-3 mt-2">
            <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {t('common.category', '카테고리')}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {categories && categories.length > 0 ? (
                categories.map((cat: CategoryTree) => (
                  <Link
                    key={cat.id}
                    to={`/products?category_id=${cat.id}`}
                    className="rounded-xl bg-gray-50 px-3 py-2.5 text-[15px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {localizedName(cat.name, cat.name_en)}
                  </Link>
                ))
              ) : (
                <p className="col-span-2 py-2 text-center text-xs text-gray-400">{t('common.loading', '불러오는 중...')}</p>
              )}
            </div>
          </div>

          {/* 마이메뉴 (로그인 시) */}
          {user && (
            <div className="px-4 py-3 mt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {t('common.menu.myMenu', '마이메뉴')}
              </p>
              <div className="space-y-0.5">
                <MenuItem to="/my/orders" icon={<ClipboardList className="h-[18px] w-[18px]" />} label={t('common.nav.orders', '주문 내역')} />
                <MenuItem to="/my/coupons" icon={<Ticket className="h-[18px] w-[18px]" />} label={t('common.menu.coupons', '쿠폰함')} />
                <MenuItem to="/my/settings" icon={<User className="h-[18px] w-[18px]" />} label={t('common.menu.accountSettings', '계정 설정')} />
                {user.role === 'seller' && (
                  <MenuItem to="/seller/dashboard" icon={<Store className="h-[18px] w-[18px]" />} label={t('common.menu.sellerCenter', '판매자 센터')} />
                )}
                {user.role === 'admin' && (
                  <MenuItem to="/admin" icon={<Shield className="h-[18px] w-[18px]" />} label={t('common.role.admin', '관리자')} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          {/* 테마 & 언어 */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex flex-1 items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900">
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{t('common.menu.theme', '테마')}</span>
              <ThemeToggle />
            </div>
            <div className="flex flex-1 items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900">
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{t('common.menu.language', '언어')}</span>
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                aria-label={t('common.menu.languageSelect', '언어 선택')}
                className="rounded-lg border-none bg-transparent text-[12px] font-bold text-gray-900 outline-none dark:text-white"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* 로그아웃 */}
          {user && (
            <button
              onClick={() => { logout(); onClose(); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2.5 text-[15px] font-bold text-red-500 transition-colors hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4" />
              {t('common.logout', '로그아웃')}
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-xl py-3 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
    >
      {icon}
      <span className="text-[12px] font-medium">{label}</span>
    </Link>
  );
}

function MenuItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        {label}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
    </Link>
  );
}
