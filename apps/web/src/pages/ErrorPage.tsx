import { useRouteError, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, AlertTriangle } from 'lucide-react';

export default function ErrorPage() {
  const error = useRouteError();
  const { t } = useTranslation('common');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-gray-950">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>
      <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-800">500</h1>
      <p className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">
        {t('serverError', '서버 오류가 발생했습니다.')}
      </p>
      <p className="mt-2 text-[13px] text-gray-400">
        {error instanceof Error ? error.message : t('unknownError', '알 수 없는 오류')}
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
