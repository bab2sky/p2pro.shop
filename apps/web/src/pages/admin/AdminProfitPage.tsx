import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import PeriodFilter from '@/components/common/PeriodFilter';
import { getPlatformSummary, downloadPlatformProfitExport } from '@/lib/api/profit';
import PlatformSummaryCards from '@/components/admin/PlatformSummaryCards';
import PlatformTrendChart from '@/components/admin/PlatformTrendChart';
import MonthlyPnLTable from '@/components/admin/MonthlyPnLTable';
import SellerContributionTable from '@/components/admin/SellerContributionTable';
import CategoryProfitTable from '@/components/admin/CategoryProfitTable';
import { Download } from 'lucide-react';

type TabKey = 'trend' | 'monthly' | 'sellers' | 'categories';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'trend', label: '트렌드' },
  { key: 'monthly', label: '월별 P&L' },
  { key: 'sellers', label: '판매자별' },
  { key: 'categories', label: '카테고리별' },
];

// ─── Main Page ───

function formatToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function format30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminProfitPage() {
  const [from, setFrom] = useState(format30DaysAgo);
  const [to, setTo] = useState(formatToday);
  const [activeTab, setActiveTab] = useState<TabKey>('trend');
  const [exporting, setExporting] = useState(false);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['platformSummary', from, to],
    queryFn: () => getPlatformSummary({ from, to }),
  });

  const handlePeriodChange = (newFrom: string, newTo: string) => {
    setFrom(newFrom);
    setTo(newTo);
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await downloadPlatformProfitExport({ from, to });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platform_profit_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [from, to]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">플랫폼 수익 분석</h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
        >
          <Download className="h-4 w-4" />
          {exporting ? '내보내는 중...' : '엑셀 다운로드'}
        </button>
      </div>

      <PeriodFilter from={from} to={to} onChange={handlePeriodChange} />

      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : summaryData?.data ? (
        <PlatformSummaryCards data={summaryData.data} />
      ) : null}

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2.5 text-sm ${
              activeTab === tab.key
                ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'trend' && <PlatformTrendChart from={from} to={to} />}
        {activeTab === 'monthly' && <MonthlyPnLTable from={from} to={to} />}
        {activeTab === 'sellers' && <SellerContributionTable from={from} to={to} />}
        {activeTab === 'categories' && <CategoryProfitTable from={from} to={to} />}
      </div>
    </div>
  );
}
