import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSellerBusinessInfo } from '@/lib/api/legal';

interface Props {
  sellerId: string;
}

/**
 * FR-A02: 판매자 사업자 정보 공개
 * 전자상거래법 필수 - 상품 상세 페이지에서 판매자 사업자 정보 조회 가능
 */
export function SellerBusinessInfo({ sellerId }: Props) {
  const { t } = useTranslation('common');
  const { data: info } = useQuery({
    queryKey: ['sellerBusinessInfo', sellerId],
    queryFn: () => getSellerBusinessInfo(sellerId),
    enabled: !!sellerId,
  });

  if (!info) return null;

  // 개인 판매자는 사업자 정보 없음
  if (info.seller_type !== 'business') {
    return (
      <div className="text-sm text-gray-500">
        {t('legal.individualSeller')}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 text-sm space-y-2 bg-gray-50 dark:bg-gray-800">
      <h4 className="font-medium text-gray-900 dark:text-white">
        {t('legal.sellerBusinessInfo')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
        {info.business_name && (
          <div>
            <span className="text-gray-400">{t('legal.storeName')}:</span>{' '}
            {info.business_name}
          </div>
        )}
        {info.business_number && (
          <div>
            <span className="text-gray-400">{t('legal.businessNumber')}:</span>{' '}
            {info.business_number}
          </div>
        )}
        {info.representative_name && (
          <div>
            <span className="text-gray-400">{t('legal.representative')}:</span>{' '}
            {info.representative_name}
          </div>
        )}
        {info.business_address && (
          <div className="col-span-full">
            <span className="text-gray-400">{t('legal.address')}:</span>{' '}
            {info.business_address}
          </div>
        )}
      </div>
    </div>
  );
}
