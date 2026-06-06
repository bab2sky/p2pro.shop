import { useTranslation } from 'react-i18next';

interface QuantitySelectorProps {
  value: number;
  max: number;
  onChange: (qty: number) => void;
}

export function QuantitySelector({ value, max, onChange }: QuantitySelectorProps) {
  const { t } = useTranslation('product');

  if (max <= 0) {
    return <span className="text-red-500 font-medium">{t('soldOut')}</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600">{t('quantity')}</span>
      <div className="flex items-center border rounded-lg">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          aria-label="수량 감소"
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-l-lg"
        >
          -
        </button>
        <span className="px-4 py-1.5 text-center min-w-[48px] border-x">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="수량 증가"
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-r-lg"
        >
          +
        </button>
      </div>
      <span className="text-xs text-gray-400">({t('stock')}: {max})</span>
    </div>
  );
}
