import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
} from 'lucide-react';
import PeriodFilter from '@/components/common/PeriodFilter';
import { getSellerProfitSummary, downloadSellerProfitExport } from '@/lib/api/profit';
import ProfitSummaryCards from '@/components/seller/ProfitSummaryCards';
import ProfitChart from '@/components/seller/ProfitChart';
import PnLStatementTab from '@/components/seller/PnLStatementTab';
import ProductProfitTable from '@/components/seller/ProductProfitTable';
import CommissionHistory from '@/components/seller/CommissionHistory';
import RefundLossReport from '@/components/seller/RefundLossReport';
import CashflowDashboard from '@/components/seller/CashflowDashboard';

type TabKey = 'overview' | 'pnl' | 'products' | 'commission' | 'refunds' | 'cashflow';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'pnl', label: '손익계산서' },
  { key: 'products', label: '상품분석' },
  { key: 'commission', label: '수수료' },
  { key: 'refunds', label: '환불' },
  { key: 'cashflow', label: '캐시플로우' },
];

// 날짜 포맷: 클라이언트 로컬 자정 기준 ISO date (YYYY-MM-DD).
// new Date().toISOString() 은 UTC 변환 후 자르므로 KST 사용자가 자정 직후
// "오늘" 누르면 전날로 잘못 표시됨. 로컬 연/월/일을 직접 추출하는 게 정답.
//
// 백엔드는 created_at::date BETWEEN $from AND $to 로 비교 — UTC tz 기준
// date 비교라 클라이언트 로컬 vs UTC boundary 차이는 SUM 결과를 9시간 정도
// 어긋나게 할 수 있다. 짧은 기간 (30일) 통계에서는 1일치 노이즈로 수용 가능.
// 정확한 timezone-aware 통계는 향후 백엔드에 user TZ 받아 처리 필요 (M-future).
function formatToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function format30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SellerProfitPage() {
  const [from, setFrom] = useState(format30DaysAgo);
  const [to, setTo] = useState(formatToday);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [exporting, setExporting] = useState(false);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['sellerProfitSummary', from, to],
    queryFn: () => getSellerProfitSummary({ from, to }),
  });

  const handlePeriodChange = (newFrom: string, newTo: string) => {
    setFrom(newFrom);
    setTo(newTo);
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await downloadSellerProfitExport({ from, to });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profit_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [from, to]);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">수익 분석</h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-full bg-gray-100 px-5 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? '내보내는 중...' : '엑셀 다운로드'}
        </button>
      </div>

      <PeriodFilter from={from} to={to} onChange={handlePeriodChange} />

      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 100 }} />
          ))}
        </div>
      ) : summaryData?.data ? (
        <ProfitSummaryCards data={summaryData.data} />
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-5 py-2.5 text-[13px] font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'overview' && <ProfitChart from={from} to={to} />}
        {activeTab === 'pnl' && <PnLStatementTab from={from} to={to} />}
        {activeTab === 'products' && <ProductProfitTable from={from} to={to} />}
        {activeTab === 'commission' && <CommissionHistory from={from} to={to} />}
        {activeTab === 'refunds' && <RefundLossReport from={from} to={to} />}
        {activeTab === 'cashflow' && <CashflowDashboard from={from} to={to} />}
      </div>
    </div>
  );
}
