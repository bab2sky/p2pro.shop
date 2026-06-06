import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, ShoppingCart, Heart, User, Bell, ChevronDown, LogOut,
  Settings, LayoutDashboard, Package, ClipboardList, Ticket,
  Store, Shield, ChevronRight, X, RotateCcw, MapPin,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { ThemeToggle } from '@/features/theme';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';

interface HeaderActionsProps {
  onMobileSearchToggle: () => void;
}

export function HeaderActions({ onMobileSearchToggle }: HeaderActionsProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.length;
  const location = useLocation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileUserOpen, setIsMobileUserOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile panel on route change
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setIsMobileUserOpen(false);
    }
  }, [location.pathname]);

  // Lock body scroll when mobile panel open
  useEffect(() => {
    if (isMobileUserOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileUserOpen]);

  // Escape + focus trap for mobile panel
  useEffect(() => {
    if (!isMobileUserOpen || !panelRef.current) return;
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const els = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (els.length) els[0].focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsMobileUserOpen(false); return; }
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
  }, [isMobileUserOpen]);

  const initial = user
    ? (user.nickname || user.email).charAt(0).toUpperCase()
    : '';

  return (
    <>
      <div className="flex items-center justify-end gap-1 sm:gap-3">
        {/* Mobile search toggle */}
        <button
          onClick={onMobileSearchToggle}
          className="rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 md:hidden dark:text-gray-100 dark:hover:bg-gray-800"
          aria-label={t('common.menu.search', '검색')}
        >
          <Search className="h-[26px] w-[26px] stroke-[1.5]" />
        </button>

        {/* Desktop language switcher (D-2 글로벌 진출) */}
        <div className="hidden md:block">
          <LanguageSwitcher variant="compact" />
        </div>

        {user ? (
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/my/wishlist" className="hidden rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 md:block dark:text-gray-100 dark:hover:bg-gray-800" title={t('common.menu.wishlistShort', '찜')}>
              <Heart className="h-[26px] w-[26px] stroke-[1.5]" />
            </Link>

            <button className="hidden rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 sm:block dark:text-gray-100 dark:hover:bg-gray-800" title={t('common.nav.notifications', '알림')}>
              <Bell className="h-[26px] w-[26px] stroke-[1.5]" />
            </button>

            <Link to="/cart" className="relative hidden rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 md:block dark:text-gray-100 dark:hover:bg-gray-800" title={t('common.cart', '장바구니')}>
              <ShoppingCart className="h-[26px] w-[26px] stroke-[1.5]" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-950">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>

            {/* Mobile: User avatar → right panel */}
            <button
              onClick={() => setIsMobileUserOpen(true)}
              className="rounded-full p-1 transition-colors hover:bg-gray-100 md:hidden dark:hover:bg-gray-800"
              aria-label={t('common.menu.myMenu', '마이메뉴')}
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 ring-2 ring-gray-200 dark:ring-gray-700">
                <span className="text-[13px] font-bold text-white select-none">
                  {(user.nickname || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
            </button>

            {/* Desktop: Profile Dropdown */}
            <div className="relative ml-2 hidden md:block" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="group flex items-center gap-2 rounded-full border border-gray-200 p-1 pr-3 transition-colors hover:bg-gray-50 focus:outline-none dark:border-gray-800 dark:hover:bg-gray-900"
              >
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <User className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-hover:text-gray-900 dark:group-hover:text-gray-100" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-2xl border border-gray-100 bg-white p-2 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-gray-800 dark:bg-gray-950">
                  <div className="mb-2 border-b border-gray-100 px-3 py-3 dark:border-gray-800">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {user.nickname || t('common.menu.member', '회원님')}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {t('common.menu.role', '권한')}: {user.role === 'admin' ? t('common.role.admin', '관리자') : user.role === 'seller' ? t('common.role.seller', '판매자') : t('common.role.member', '일반 회원')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <DropdownLink to="/my/orders" icon={<Package className="h-4 w-4" />} label={t('common.nav.orders', '주문내역')} onClick={() => setIsDropdownOpen(false)} />
                    <DropdownLink to="/my/wishlist" icon={<Heart className="h-4 w-4" />} label={t('common.nav.wishlist', '관심상품')} onClick={() => setIsDropdownOpen(false)} />
                    <DropdownLink to="/my" icon={<Settings className="h-4 w-4" />} label={t('common.mypage', '마이페이지')} onClick={() => setIsDropdownOpen(false)} />
                    {user.role === 'seller' && (
                      <Link to="/seller/dashboard" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 rounded-xl bg-indigo-50/50 px-3 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40">
                        <LayoutDashboard className="h-4 w-4" />
                        {t('common.menu.sellerCenter', '판매자 센터')}
                      </Link>
                    )}
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 rounded-xl bg-purple-50/50 px-3 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40">
                        <LayoutDashboard className="h-4 w-4" />
                        {t('common.menu.adminDashboard', '관리자 대시보드')}
                      </Link>
                    )}
                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                    <button onClick={() => { setIsDropdownOpen(false); logout(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900/50">
                      <LogOut className="h-4 w-4" />
                      {t('common.logout', '로그아웃')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/cart" className="relative hidden rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 md:block dark:text-gray-100 dark:hover:bg-gray-800" title={t('common.cart', '장바구니')}>
              <ShoppingCart className="h-[26px] w-[26px] stroke-[1.5]" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-950">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>

            {/* Mobile: User icon for non-logged in */}
            <button
              onClick={() => setIsMobileUserOpen(true)}
              className="rounded-full p-1 transition-colors hover:bg-gray-100 md:hidden dark:hover:bg-gray-800"
              aria-label={t('common.login', '로그인')}
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-2 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
            </button>

            {/* Desktop: login/register buttons */}
            <div className="ml-2 hidden items-center gap-1 md:flex">
              <Link to="/login" className="rounded-full px-4 py-2 text-[14px] font-bold text-gray-900 transition-colors hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800">
                {t('common.login', '로그인')}
              </Link>
              <Link to="/register" className="rounded-full bg-gray-900 px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                {t('common.register', '회원가입')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile User Panel (Right Slide) ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isMobileUserOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsMobileUserOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('common.menu.myMenu', '마이메뉴')}
        className={`fixed inset-y-0 right-0 z-50 flex w-[300px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden dark:bg-gray-950 ${
          isMobileUserOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">{t('common.menu.myMenu', '마이메뉴')}</h2>
          <button
            onClick={() => setIsMobileUserOpen(false)}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label={t('common.menu.close', '닫기')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Card */}
        {user ? (
          <Link
            to="/my"
            className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3.5 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
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
            <Link to="/login" className="flex-1 rounded-xl border border-gray-200 py-2.5 text-center text-[15px] font-bold text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800">
              {t('common.login', '로그인')}
            </Link>
            <Link to="/register" className="flex-1 rounded-xl bg-gray-900 py-2.5 text-center text-[15px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
              {t('common.register', '회원가입')}
            </Link>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4">
          {user && (
            <>
              <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {t('common.mypage', '마이페이지')}
              </p>
              <div className="space-y-0.5">
                <PanelItem to="/my" icon={<LayoutDashboard className="h-[18px] w-[18px]" />} label={t('common.menu.dashboard', '대시보드')} />
                <PanelItem to="/my/orders" icon={<ClipboardList className="h-[18px] w-[18px]" />} label={t('common.nav.orders', '주문내역')} />
                <PanelItem to="/my/refunds" icon={<RotateCcw className="h-[18px] w-[18px]" />} label={t('common.menu.refundsDisputes', '환불/분쟁')} />
                <PanelItem to="/my/addresses" icon={<MapPin className="h-[18px] w-[18px]" />} label={t('common.menu.addresses', '주소록')} />
                <PanelItem to="/my/coupons" icon={<Ticket className="h-[18px] w-[18px]" />} label={t('common.menu.coupons', '쿠폰함')} />
                <PanelItem to="/my/wishlist" icon={<Heart className="h-[18px] w-[18px]" />} label={t('common.nav.wishlist', '위시리스트')} />
              </div>

              <div className="my-3 border-t border-gray-100 dark:border-gray-800" />

              <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {t('common.legal.shopping', '쇼핑')}
              </p>
              <div className="space-y-0.5">
                <PanelItem to="/cart" icon={<ShoppingCart className="h-[18px] w-[18px]" />} label={t('common.cart', '장바구니')} />
              </div>

              <div className="my-3 border-t border-gray-100 dark:border-gray-800" />

              <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {t('common.menu.account', '계정')}
              </p>
              <div className="space-y-0.5">
                <PanelItem to="/my/settings" icon={<Settings className="h-[18px] w-[18px]" />} label={t('common.menu.accountSettings', '계정 설정')} />
                {user.role === 'seller' && (
                  <PanelItem to="/seller/dashboard" icon={<Store className="h-[18px] w-[18px]" />} label={t('common.menu.sellerCenter', '판매자 센터')} highlight />
                )}
                {user.role === 'admin' && (
                  <PanelItem to="/admin" icon={<Shield className="h-[18px] w-[18px]" />} label={t('common.role.admin', '관리자')} highlight />
                )}
              </div>
            </>
          )}
        </div>

        {/* Panel Footer */}
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
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

          {user && (
            <button
              onClick={() => { logout(); setIsMobileUserOpen(false); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2.5 text-[15px] font-bold text-red-500 transition-colors hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4" />
              {t('common.logout', '로그아웃')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function DropdownLink({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900/50">
      {icon}
      {label}
    </Link>
  );
}

function PanelItem({ to, icon, label, highlight }: { to: string; icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-base font-bold transition-colors ${
        highlight
          ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30'
          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className={highlight ? '' : 'text-gray-400 dark:text-gray-500'}>{icon}</span>
        {label}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
    </Link>
  );
}
