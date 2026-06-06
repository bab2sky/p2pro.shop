import { useCallback } from 'react';

interface PeriodFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const inputClass = 'rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function PeriodFilter({ from, to, onChange }: PeriodFilterProps) {
  const setQuick = useCallback(
    (days: number) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      onChange(formatDate(start), formatDate(end));
    },
    [onChange],
  );

  const setThisMonth = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    onChange(formatDate(start), formatDate(now));
  }, [onChange]);

  const setLastMonth = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    onChange(formatDate(start), formatDate(end));
  }, [onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className={inputClass}
        />
        <span className="text-sm text-gray-400">~</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex gap-1">
        {[
          { label: '최근 7일', action: () => setQuick(7) },
          { label: '최근 30일', action: () => setQuick(30) },
          { label: '이번 달', action: setThisMonth },
          { label: '지난 달', action: setLastMonth },
          { label: '최근 3개월', action: () => setQuick(90) },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.action}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
