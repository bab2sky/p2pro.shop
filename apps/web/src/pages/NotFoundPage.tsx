import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, SearchX } from 'lucide-react';

export default function NotFoundPage() {
  const { t } = useTranslation('common');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800">
        <SearchX className="h-10 w-10 text-gray-300 dark:text-gray-600" />
      </div>
      <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-800">404</h1>
      <p className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">
        {t('pageNotFound', '요청하신 페이지를 찾을 수 없습니다.')}
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        <Home className="h-3.5 w-3.5" />
        {t('goHome', '홈으로 돌아가기')}
      </Link>
    </div>
  );
}
