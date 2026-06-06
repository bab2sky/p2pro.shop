import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, X } from 'lucide-react';
import { useCompareStore } from '@/stores/compare';

export function CompareFloatingBar() {
  const { t } = useTranslation();
  const { compareItems, clearCompare } = useCompareStore();

  if (compareItems.length === 0) return null;

  return (
    <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 md:bottom-6">
      <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <BarChart3 className="h-4 w-4 text-indigo-500" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {t('product.compare.selected', { count: compareItems.length, defaultValue: '{{count}}/4 상품 선택됨' })}
        </span>

        <Link
          to="/compare"
          className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
        >
          {t('product.compare.compareNow', '비교하기')}
        </Link>

        <button
          onClick={clearCompare}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label={t('product.compare.clearAria', '비교 목록 초기화')}
        >
          <X className="h-3 w-3" />
          {t('product.compare.clear', '초기화')}
        </button>
      </div>
    </div>
  );
}
