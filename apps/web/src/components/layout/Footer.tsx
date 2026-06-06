import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BusinessInfoFooter } from '@/components/legal/BusinessInfoFooter';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { Instagram, Facebook, Youtube } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation(['common', 'product', 'seller', 'profile']);

  return (
    <footer className="border-t border-gray-200 bg-[#FAFAFA] dark:border-gray-800 dark:bg-gray-950 mb-16 md:mb-0" role="contentinfo" aria-label="사이트 푸터">

      {/* ───── Mobile Footer (md 미만) ───── */}
      <div className="block md:hidden">
        <div className="flex justify-center px-4 pt-4">
          <LanguageSwitcher variant="compact" />
        </div>
        <p className="py-4 text-center text-[11px] text-gray-400">&copy; 2026 P2PRO Store. All rights reserved.</p>
      </div>

      {/* ───── Desktop Footer (md 이상) ───── */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 sm:py-12">
          <div className="flex flex-col justify-between gap-10 md:flex-row md:gap-8">

            {/* Left: CS Info & Logo */}
            <div className="flex-1">
              <h3 className="mb-6 text-[22px] font-black tracking-tighter text-gray-900 dark:text-white">
                P2PRO<span className="text-pink-500">.</span>
              </h3>

              <div className="mb-2">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('common.legal.customerCenter', '고객센터')}</h4>
                <p className="mt-1 text-[28px] font-black tracking-tight text-gray-900 dark:text-white">1577-0000</p>
              </div>

              <p className="mb-5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                {t('common.legal.businessHours', '평일 09:30 - 17:30 (점심시간 12:00 - 13:00)')}<br />
                {t('common.legal.weekendClosed', '주말 및 공휴일 휴무')}
              </p>

              <div className="flex gap-2">
                <Link to="/contact" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                  {t('common.legal.contactUs', '1:1 문의')}
                </Link>
                <Link to="/faq" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                  {t('common.faq', 'FAQ')}
                </Link>
              </div>
            </div>

            {/* Right: Links */}
            <div className="grid flex-[2] grid-cols-2 gap-8 sm:grid-cols-4 md:justify-end">
              <div>
                <h4 className="mb-4 text-[15px] font-bold text-gray-900 dark:text-gray-100">{t('common.legal.shopping', '쇼핑')}</h4>
                <ul className="space-y-2 text-[14px] text-gray-500 dark:text-gray-400">
                  <li><Link to="/products" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('product.list.title', '전체 상품')}</Link></li>
                  <li><Link to="/categories" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('common.nav.categories', '카테고리')}</Link></li>
                  <li><Link to="/cart" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('common.cart', '장바구니')}</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-[15px] font-bold text-gray-900 dark:text-gray-100">{t('seller.badge', '판매자 메뉴')}</h4>
                <ul className="space-y-2 text-[14px] text-gray-500 dark:text-gray-400">
                  <li><Link to="/seller/apply" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('common.legal.sellerApply', '입점 신청')}</Link></li>
                  <li><Link to="/seller/dashboard" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('dashboardPage.title', '판매자 센터')}</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-[15px] font-bold text-gray-900 dark:text-gray-100">{t('common.legal.aboutP2pro', 'P2PRO 안내')}</h4>
                <ul className="space-y-2 text-[14px] text-gray-500 dark:text-gray-400">
                  <li><Link to="/notices" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('common.notices', '공지사항')}</Link></li>
                  <li><Link to="/about" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('common.legal.aboutUs', '회사소개')}</Link></li>
                  <li><a href="https://udgworld.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-900 dark:hover:text-white">UDG World</a></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-[15px] font-bold text-gray-900 dark:text-gray-100">{t('common.legal.termsPolicy', '약관 및 정책')}</h4>
                <ul className="space-y-2 text-[14px] text-gray-500 dark:text-gray-400">
                  <li><Link to="/terms" className="transition-colors hover:text-gray-900 dark:hover:text-white">{t('common.termsOfService', '이용약관')}</Link></li>
                  <li><Link to="/privacy" className="font-bold text-gray-900 transition-colors hover:underline dark:text-gray-100">{t('common.privacyPolicy', '개인정보처리방침')}</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* SNS & Copyright */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row dark:border-gray-800">
            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white">
                <span className="sr-only">Instagram</span>
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white">
                <span className="sr-only">Facebook</span>
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white">
                <span className="sr-only">YouTube</span>
                <Youtube className="h-5 w-5" />
              </a>
              <span className="mx-2 h-4 w-px bg-gray-300 dark:bg-gray-700" />
              <LanguageSwitcher variant="compact" />
            </div>
            <p className="text-[12px] text-gray-400">
              &copy; 2026 P2PRO Store. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic business info footer */}
      <div className="bg-gray-100 dark:bg-gray-900">
        <BusinessInfoFooter />
      </div>
    </footer>
  );
}
