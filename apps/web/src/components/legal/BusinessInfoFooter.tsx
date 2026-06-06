import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBusinessInfo } from '@/lib/api/legal';

/**
 * FR-A01: 사업자 정보 푸터 표시
 * FR-A03: 구매안전서비스 고지
 * 전자상거래법 필수 - 사이트 하단에 사업자 정보 노출
 */
export function BusinessInfoFooter() {
  const { t } = useTranslation('common');
  const { data: info } = useQuery({
    queryKey: ['businessInfo'],
    queryFn: getBusinessInfo,
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  if (!info || !info.company_name) return null;

  return (
    <div className="border-t bg-gray-50 dark:bg-gray-800 py-6">
      <div className="mx-auto max-w-7xl px-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{t('legal.companyName')}: {info.company_name}</span>
          <span>{t('legal.representative')}: {info.representative}</span>
          <span>{t('legal.businessNumber')}: {info.business_number}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{t('legal.onlineSalesNumber')}: {info.online_sales_number}</span>
          <span>{t('legal.address')}: {info.address}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{t('legal.customerCenter')}: {info.customer_center}</span>
          <span>{t('legal.email')}: {info.email}</span>
        </div>
        {info.escrow_service && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="inline-flex items-center gap-1 text-gray-900 dark:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {info.escrow_service.description}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
