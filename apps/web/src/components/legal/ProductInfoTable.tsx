import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getProductLegalInfo } from '@/lib/api/legal';

interface Props {
  productId: string;
}

/**
 * FR-A06: 전자상거래법 필수 상품정보
 * FR-A07: KC인증 표시
 * 상품 상세 페이지에 법적 필수 상품 정보 테이블 표시
 */
export function ProductInfoTable({ productId }: Props) {
  const { t } = useTranslation('common');
  const { data: info } = useQuery({
    queryKey: ['productLegalInfo', productId],
    queryFn: () => getProductLegalInfo(productId),
    enabled: !!productId,
  });

  if (!info) return null;

  const hasAnyInfo =
    info.manufacturer ||
    info.origin_country ||
    info.kc_certification ||
    info.category_attributes.length > 0;

  if (!hasAnyInfo) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <h4 className="px-4 py-3 bg-gray-50 dark:bg-gray-800 font-medium text-sm text-gray-900 dark:text-white">
        {t('legal.productInfo')}
      </h4>
      <table className="w-full text-sm">
        <tbody className="divide-y dark:divide-gray-700">
          {info.manufacturer && (
            <tr>
              <td className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-gray-500 w-1/3">
                {t('legal.manufacturer')}
              </td>
              <td className="px-4 py-2.5 text-gray-900 dark:text-white">
                {info.manufacturer}
              </td>
            </tr>
          )}
          {info.origin_country && (
            <tr>
              <td className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-gray-500 w-1/3">
                {t('legal.originCountry')}
              </td>
              <td className="px-4 py-2.5 text-gray-900 dark:text-white">
                {info.origin_country}
              </td>
            </tr>
          )}
          {info.condition && info.condition !== 'new' && (
            <tr>
              <td className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-gray-500 w-1/3">
                {t('legal.productCondition')}
              </td>
              <td className="px-4 py-2.5 text-gray-900 dark:text-white">
                {info.condition === 'used' ? t('legal.conditionUsed') : t('legal.conditionRefurbished')}
              </td>
            </tr>
          )}
          {info.kc_certification && (
            <tr>
              <td className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-gray-500 w-1/3">
                {t('legal.kcCertification')}
              </td>
              <td className="px-4 py-2.5 text-gray-900 dark:text-white">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                    KC
                  </span>
                  {info.kc_certification.type} ({info.kc_certification.number})
                </span>
              </td>
            </tr>
          )}
          {info.category_attributes.map((attr, i) => (
            <tr key={i}>
              <td className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-gray-500 w-1/3">
                {attr.name}
              </td>
              <td className="px-4 py-2.5 text-gray-900 dark:text-white">
                {attr.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
