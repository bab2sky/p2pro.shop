import { useTranslation } from 'react-i18next';

/**
 * FR-A03: 구매안전서비스 고지
 * 주문/결제 페이지에 USDT 에스크로 구매안전서비스 가입 사실 표시
 */
export function EscrowNotice() {
  const { t } = useTranslation('common');

  return (
    <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl">
      <svg className="w-5 h-5 text-gray-900 dark:text-white shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <div className="text-sm">
        <p className="font-medium text-gray-900 dark:text-white">
          {t('legal.escrowTitle')}
        </p>
        <p className="text-gray-900 dark:text-white mt-1">
          {t('legal.escrowDescription')}
        </p>
      </div>
    </div>
  );
}
