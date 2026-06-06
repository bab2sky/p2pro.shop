import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

export function SimplePageHeader() {
  const { t } = useTranslation();
  const NAV_LINKS = [
    { to: '/notices', label: t('common.notices', '공지사항') },
    { to: '/contact', label: t('common.legal.contactUs', '1:1 문의') },
    { to: '/faq', label: t('common.faq', 'FAQ') },
    { to: '/about', label: t('common.legal.aboutUs', '회사소개') },
    { to: '/terms', label: t('common.termsOfService', '이용약관') },
    { to: '/privacy', label: t('common.privacyPolicy', '개인정보처리방침') },
  ];
  const { pathname } = useLocation();

  return (
    <header className="bg-white dark:bg-gray-900">
      {/* 1단: 로고(좌 끝) + 홈으로 돌아가기(우 끝) */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <Link to="/" className="text-[18px] font-black tracking-tighter text-gray-900 dark:text-white">
          P2PRO<span className="text-pink-500">.</span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('common.menu.backToHome', '홈으로 돌아가기')}
        </Link>
      </div>

      {/* 2단: 메뉴 링크 — 컨텐츠 사이즈 기준 */}
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <ul className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.to;
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`relative block whitespace-nowrap text-[15px] font-bold text-gray-900 transition-colors dark:text-white sm:text-[16px] ${
                    isActive
                      ? 'after:absolute after:-bottom-[13px] after:left-0 after:h-[2px] after:w-full after:bg-gray-900 dark:after:bg-white'
                      : 'hover:text-black dark:hover:text-gray-200'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
