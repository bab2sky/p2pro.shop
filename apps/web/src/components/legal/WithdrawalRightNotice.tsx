import { useTranslation } from 'react-i18next';

/**
 * FR-A05: 청약철회 안내
 * 상품 상세 및 주문 페이지에 7일 청약철회 조건, 반품 절차, 반품 배송비 안내 표시
 */
export function WithdrawalRightNotice() {
  const { t } = useTranslation('common');

  return (
    <div className="border rounded-lg p-4 text-sm space-y-3">
      <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {t('legal.withdrawalTitle')}
      </h4>
      <div className="space-y-2 text-gray-600 dark:text-gray-400">
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {t('legal.withdrawalPeriod')}:
          </span>{' '}
          {t('legal.withdrawalPeriodDesc')}
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {t('legal.withdrawalCondition')}:
          </span>{' '}
          {t('legal.withdrawalConditionDesc')}
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {t('legal.returnShippingFee')}:
          </span>{' '}
          {t('legal.returnShippingFeeDesc')}
        </div>
      </div>
    </div>
  );
}
