import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCategoryAttributes, type CategoryAttribute } from '@/lib/api/legal';

interface Props {
  categoryId: string;
  values: Record<string, string>;
  onChange: (attributeId: string, value: string) => void;
  errors?: Record<string, string>;
}

/**
 * FR-A06: 카테고리별 법정 필수 정보 입력 시스템
 * 판매자 상품 등록 시 카테고리에 따른 필수 속성 입력 폼
 */
export function CategoryRequiredInfo({ categoryId, values, onChange, errors }: Props) {
  const { t } = useTranslation('common');
  const { data: attributes } = useQuery({
    queryKey: ['categoryAttributes', categoryId],
    queryFn: () => getCategoryAttributes(categoryId),
    enabled: !!categoryId,
  });

  if (!attributes || attributes.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
        {t('legal.categoryRequiredInfo')}
      </h4>
      {attributes.map((attr) => (
        <AttributeInput
          key={attr.id}
          attribute={attr}
          value={values[attr.id] || ''}
          onChange={(val) => onChange(attr.id, val)}
          error={errors?.[attr.id]}
        />
      ))}
    </div>
  );
}

function AttributeInput({
  attribute,
  value,
  onChange,
  error,
}: {
  attribute: CategoryAttribute;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const label = attribute.attribute_name + (attribute.is_required ? ' *' : '');

  if (attribute.attribute_type === 'select' && attribute.options) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
        >
          <option value="">{attribute.placeholder || '선택하세요'}</option>
          {attribute.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    );
  }

  if (attribute.attribute_type === 'boolean') {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            className="rounded"
          />
          <span className="text-gray-700 dark:text-gray-300">{label}</span>
        </label>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type={attribute.attribute_type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={attribute.placeholder || ''}
        className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
