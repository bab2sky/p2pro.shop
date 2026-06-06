import { useTranslation } from 'react-i18next';

interface ProductOption {
  id: string;
  option_name: string;
  option_value: string;
  additional_price: number;
  stock: number;
}

interface ProductOptionsProps {
  options: ProductOption[];
  selected: Record<string, string>;
  onSelect: (name: string, value: string) => void;
}

export function ProductOptions({ options, selected, onSelect }: ProductOptionsProps) {
  const { t } = useTranslation('product');

  // Group options by name
  const groups: Record<string, ProductOption[]> = {};
  for (const opt of options) {
    if (!groups[opt.option_name]) groups[opt.option_name] = [];
    groups[opt.option_name].push(opt);
  }

  if (Object.keys(groups).length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">{t('options')}</h3>
      {Object.entries(groups).map(([name, opts]) => (
        <div key={name}>
          <label className="text-sm text-gray-600 mb-2 block">{name}</label>
          <div className="flex flex-wrap gap-2">
            {opts.map((opt) => {
              const isSelected = selected[name] === opt.option_value;
              const isOutOfStock = opt.stock <= 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => !isOutOfStock && onSelect(name, opt.option_value)}
                  disabled={isOutOfStock}
                  className={`px-4 py-2 text-sm border rounded-full transition-colors ${
                    isSelected
                      ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white'
                      : isOutOfStock
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  {opt.option_value}
                  {opt.additional_price > 0 && (
                    <span className="ml-1 text-xs text-gray-400">+{opt.additional_price}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
