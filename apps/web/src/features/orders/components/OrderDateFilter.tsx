import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type DatePreset = '1w' | '1m' | '3m' | '6m' | 'custom';

interface OrderDateFilterProps {
  onFilter: (from: string, to: string) => void;
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case '1w':
      from.setDate(from.getDate() - 7);
      break;
    case '1m':
      from.setMonth(from.getMonth() - 1);
      break;
    case '3m':
      from.setMonth(from.getMonth() - 3);
      break;
    case '6m':
      from.setMonth(from.getMonth() - 6);
      break;
    default:
      return { from: '', to: '' };
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export function OrderDateFilter({ onFilter }: OrderDateFilterProps) {
  const { t } = useTranslation('order');
  const [active, setActive] = useState<DatePreset | null>(null);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const presets: { key: DatePreset; label: string }[] = [
    { key: '1w', label: t('dateFilter.week') },
    { key: '1m', label: t('dateFilter.month') },
    { key: '3m', label: t('dateFilter.threeMonths') },
    { key: '6m', label: t('dateFilter.sixMonths') },
    { key: 'custom', label: t('dateFilter.custom') },
  ];

  const handlePreset = (preset: DatePreset) => {
    setActive(preset);
    if (preset !== 'custom') {
      const range = getDateRange(preset);
      onFilter(range.from, range.to);
    }
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onFilter(customFrom, customTo);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {presets.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePreset(key)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              active === key
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {active === 'custom' && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="border rounded-xl px-3 py-1.5 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="border rounded-xl px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            className="px-3 py-1.5 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full hover:bg-gray-800 dark:hover:bg-gray-100"
          >
            {t('dateFilter.custom')}
          </button>
        </div>
      )}
    </div>
  );
}
