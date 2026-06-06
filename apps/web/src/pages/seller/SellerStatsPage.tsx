import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  BarChart3,
  ShoppingBag,
  CheckCircle,
  X,
  DollarSign,
  Percent,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { getDashboardStats, getSalesStats, getProfitAnalysis, type DailySales } from '@/lib/api/seller';
import { getSellerOrders, type SellerOrderSummary } from '@/lib/api/orders';

type ViewMode = 'daily' | 'weekly' | 'monthly';

export default function SellerStatsPage() {
  const { t } = useTranslation('seller');
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedPeriod, setSelectedPeriod] = useState<{ from: string; to: string; label: string } | null>(null);

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending_payment: { label: t('statusMap.pendingPayment'), color: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' },
    txid_submitted: { label: t('statusMap.txidSubmitted'), color: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10' },
    verifying: { label: t('statusMap.verifying'), color: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10' },
    payment_verified: { label: t('statusMap.paymentVerified'), color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
    shipped: { label: t('statusMap.shipped'), color: 'bg-pink-50 text-pink-500 dark:bg-pink-500/10' },
    delivered: { label: t('statusMap.delivered'), color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
    confirmed: { label: t('statusMap.confirmed'), color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
    cancelled: { label: t('statusMap.cancelled'), color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
    refunded: { label: t('statusMap.refunded'), color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
    disputed: { label: t('statusMap.disputed'), color: 'bg-orange-50 text-orange-500 dark:bg-orange-500/10' },
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['sellerDashboardStats'],
    queryFn: getDashboardStats,
  });

  const { data: dailySales, isLoading: salesLoading } = useQuery({
    queryKey: ['sellerSalesStats'],
    queryFn: getSalesStats,
  });

  const { data: periodOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['sellerOrders', 'stats-drilldown', selectedPeriod?.from, selectedPeriod?.to],
    queryFn: () => getSellerOrders({
      per_page: 100,
      date_from: selectedPeriod!.from,
      date_to: selectedPeriod!.to,
    }),
    enabled: !!selectedPeriod,
  });

  // Authoritative 30-day profit analysis from backend (replaces buggy client-side
  // reduce that summed cancelled/refunded into revenue and was capped at 100 orders).
  const { data: profit } = useQuery({
    queryKey: ['sellerProfitAnalysis'],
    queryFn: getProfitAnalysis,
  });

  const aggregatedData = useMemo((): AggregatedSales[] => {
    if (!dailySales) return [];
    if (viewMode === 'daily') return dailySales.map((d) => ({
      ...d,
      dateFrom: d.date,
      dateTo: d.date,
      label: d.date,
      chartLabel: d.date.slice(5),
    }));
    if (viewMode === 'weekly') return aggregateWeekly(dailySales);
    return aggregateMonthly(dailySales);
  }, [dailySales, viewMode]);

  const maxAmount = useMemo(() => {
    return Math.max(1, ...aggregatedData.map((d) => Number(d.total_amount)));
  }, [aggregatedData]);

  const totalOrders = useMemo(() => aggregatedData.reduce((sum, d) => sum + d.order_count, 0), [aggregatedData]);
  const totalAmount = useMemo(() => aggregatedData.reduce((sum, d) => sum + Number(d.total_amount), 0), [aggregatedData]);
  const avgDaily = dailySales ? totalAmount / Math.max(dailySales.length, 1) : 0;

  // Trust the backend numbers verbatim. Only coerce strings → numbers for display.
  const profitAnalysis = useMemo(() => ({
    totalRevenue:   Number(profit?.total_revenue   ?? 0),
    commission:     Number(profit?.commission      ?? 0),
    // v1.3.11 — settlement 와 일치하는 effective rate (per-order commission 기준).
    // 매출 0 또는 응답 누락 시 5.0 fallback.
    commissionRate: Number(profit?.commission_rate_pct ?? 5),
    netProfit:      Number(profit?.net_profit      ?? 0),
    avgMarginRate:  Number(profit?.avg_margin_rate ?? 0),
    refundRate:     Number(profit?.refund_rate     ?? 0),
    disputeRate:    Number(profit?.dispute_rate    ?? 0),
  }), [profit]);

  // Period comparison: last 30 days vs the previous 30 days (both numbers come from
  // backend so we don't suffer the "current calendar month is partial" distortion the
  // old implementation had near the start of each month.
  const monthlyComparison = useMemo(() => {
    if (!profit) return null;
    const last30 = Number(profit.total_revenue);
    const prev30 = Number(profit.previous_revenue);

    if (last30 === 0 && prev30 === 0) return { type: 'noData' as const };
    if (prev30 === 0) return { type: 'noData' as const };

    const changePercent = ((last30 - prev30) / prev30) * 100;
    if (Math.abs(changePercent) < 0.05) return { type: 'noChange' as const };

    return {
      type: 'comparison' as const,
      change: Math.abs(changePercent).toFixed(1),
      direction: changePercent > 0 ? 'increased' : 'decreased',
    };
  }, [profit]);

  const viewModeLabel = viewMode === 'daily' ? t('stats.viewDaily') : viewMode === 'weekly' ? t('stats.viewWeekly') : t('stats.viewMonthly');

  if (statsLoading || salesLoading)
    return (
      <div className="max-w-6xl space-y-4 py-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 100 }} />
        ))}
      </div>
    );

  const handlePeriodClick = (item: AggregatedSales) => {
    setSelectedPeriod({
      from: item.dateFrom,
      to: item.dateTo,
      label: item.label,
    });
  };

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">{t('stats.title')}</h1>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label={t('stats.todaySales')} value={`₮ ${fmt(stats?.today_sales)}`} sub="USDT" icon={<TrendingUp className="h-4 w-4 text-pink-500" />} iconBg="bg-pink-50 dark:bg-pink-500/10" valueColor="text-pink-500" />
        <SummaryCard label={t('stats.monthSales')} value={`₮ ${fmt(stats?.month_sales)}`} sub="USDT" icon={<CalendarDays className="h-4 w-4 text-purple-500" />} iconBg="bg-purple-50 dark:bg-purple-500/10" />
        <SummaryCard label={t('stats.avg30Days')} value={`₮ ${avgDaily.toFixed(1)}`} sub={t('stats.dailyAvg')} icon={<BarChart3 className="h-4 w-4 text-gray-500" />} iconBg="bg-gray-100 dark:bg-gray-800" />
        <SummaryCard label={t('stats.totalOrders')} value={t('stats.orderCount', { count: stats?.confirmed_orders ?? 0 })} sub={t('stats.totalIncludingCancelled', { count: stats?.total_orders ?? 0 })} icon={<ShoppingBag className="h-4 w-4 text-emerald-500" />} iconBg="bg-emerald-50 dark:bg-emerald-500/10" />
        <SummaryCard label={t('stats.sum30Days')} value={`₮ ${totalAmount.toLocaleString()}`} sub={t('stats.orderCount', { count: totalOrders })} icon={<CheckCircle className="h-4 w-4 text-amber-500" />} iconBg="bg-amber-50 dark:bg-amber-500/10" />
      </div>

      {/* View mode selector */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {([
            { value: 'daily' as const, label: t('stats.viewDaily') },
            { value: 'weekly' as const, label: t('stats.viewWeekly') },
            { value: 'monthly' as const, label: t('stats.viewMonthly') },
          ]).map((mode) => (
            <button
              key={mode.value}
              onClick={() => { setViewMode(mode.value); setSelectedPeriod(null); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === mode.value
                  ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-gray-400 dark:text-gray-500">{t('stats.last30DaysBasis')}</p>
      </div>

      {/* Chart */}
      <div className="mb-6 rounded-2xl border border-gray-300 bg-white p-6 dark:border-gray-600 dark:bg-gray-900">
        <h2 className="mb-4 text-base font-bold text-gray-900 dark:text-white">
          {t('stats.salesTrend', { mode: viewModeLabel })}
        </h2>
        <div className="flex items-end gap-1" style={{ height: '220px' }}>
          {aggregatedData.map((d, i) => {
            const height = maxAmount > 0 ? (Number(d.total_amount) / maxAmount) * 100 : 0;
            const isSelected = selectedPeriod?.from === d.dateFrom && selectedPeriod?.to === d.dateTo;
            return (
              <div
                key={i}
                className="group relative flex flex-1 cursor-pointer flex-col items-center"
                style={{ height: '100%' }}
                onClick={() => handlePeriodClick(d)}
              >
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      isSelected
                        ? 'bg-pink-500 ring-2 ring-pink-300 dark:ring-pink-500/30'
                        : d.order_count > 0
                          ? 'bg-gray-300 group-hover:bg-gray-900 dark:bg-gray-600 dark:group-hover:bg-white'
                          : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
                <span className="mt-1 w-full truncate text-center text-[10px] text-gray-400">
                  {d.chartLabel}
                </span>
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-2xl bg-gray-900 px-4 py-3 text-[12px] text-white shadow-xl group-hover:block dark:bg-gray-800">
                  <p className="font-bold">{d.label}</p>
                  <p className="mt-1">{t('stats.tooltip.sales')}: <span className="text-pink-400">₮ {Number(d.total_amount).toLocaleString()}</span></p>
                  <p>{t('stats.tooltip.orders')}: {t('stats.orderCount', { count: d.order_count })}</p>
                  <p className="mt-1 text-[10px] text-gray-400">{t('stats.tooltip.clickForDetail')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Period table */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3.5 dark:border-gray-700 dark:bg-gray-800/50">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {t('stats.periodDetail', { mode: viewModeLabel })}
          </h2>
          <p className="text-[12px] text-gray-400 dark:text-gray-500">{t('stats.clickRowHint')}</p>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.period')}</th>
                <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.orderCountHeader')}</th>
                <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.salesAmount')}</th>
                <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.avgPerOrder')}</th>
                <th className="px-5 py-2.5 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.ratio')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[...aggregatedData].reverse().map((d, i) => {
                const isSelected = selectedPeriod?.from === d.dateFrom && selectedPeriod?.to === d.dateTo;
                const amount = Number(d.total_amount);
                const avgPerOrder = d.order_count > 0 ? amount / d.order_count : 0;
                const ratio = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => handlePeriodClick(d)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-pink-50/50 dark:bg-pink-500/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span className={`text-sm ${isSelected ? 'font-bold text-pink-500' : 'text-gray-700 dark:text-gray-300'}`}>{d.label}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {d.order_count > 0 ? (
                        <span className="font-bold text-gray-900 dark:text-white">{t('stats.orderCount', { count: d.order_count })}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {amount > 0 ? `₮ ${amount.toLocaleString()}` : <span className="text-gray-300 dark:text-gray-600">-</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                      {avgPerOrder > 0 ? `₮ ${avgPerOrder.toFixed(1)}` : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="h-1.5 w-16 rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-1.5 rounded-full bg-gray-900 transition-all dark:bg-white"
                            style={{ width: `${Math.min(ratio, 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-[12px] text-gray-400">{ratio.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">{t('stats.total')}</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">{t('stats.orderCount', { count: totalOrders })}</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-pink-500">₮ {totalAmount.toLocaleString()}</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-gray-500 dark:text-gray-400">
                  ₮ {totalOrders > 0 ? (totalAmount / totalOrders).toFixed(1) : '0'}
                </td>
                <td className="px-5 py-3 text-center text-[12px] text-gray-400">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Profit Analysis Section (Task 2: FR-25) */}
      <div className="mb-6 rounded-2xl border border-gray-300 bg-white p-6 dark:border-gray-600 dark:bg-gray-900">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          {t('stats.profitAnalysis.title')}
        </h2>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-[12px] font-medium text-gray-400">{t('stats.profitAnalysis.totalRevenue')}</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">₮ {profitAnalysis.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-[12px] font-medium text-gray-400">{t('stats.profitAnalysis.commission', { rate: profitAnalysis.commissionRate.toFixed(1) })}</p>
            <p className="mt-1 text-lg font-bold text-red-500">- ₮ {profitAnalysis.commission.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
            <p className="text-[12px] font-medium text-gray-400">{t('stats.profitAnalysis.netProfit')}</p>
            <p className="mt-1 text-lg font-bold text-emerald-500">₮ {profitAnalysis.netProfit.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-[12px] font-medium text-gray-400">{t('stats.profitAnalysis.avgMarginRate')}</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{profitAnalysis.avgMarginRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Refund/Dispute Rate */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className={`rounded-xl p-4 ${profitAnalysis.refundRate <= 3 ? 'bg-emerald-50 dark:bg-emerald-500/10' : profitAnalysis.refundRate <= 10 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
            <div className="flex items-center gap-2">
              <Percent className={`h-4 w-4 ${profitAnalysis.refundRate <= 3 ? 'text-emerald-500' : profitAnalysis.refundRate <= 10 ? 'text-amber-500' : 'text-red-500'}`} />
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{t('stats.profitAnalysis.refundRate')}</p>
            </div>
            <p className={`mt-1 text-lg font-bold ${profitAnalysis.refundRate <= 3 ? 'text-emerald-500' : profitAnalysis.refundRate <= 10 ? 'text-amber-500' : 'text-red-500'}`}>
              {profitAnalysis.refundRate.toFixed(1)}%
            </p>
          </div>
          <div className={`rounded-xl p-4 ${profitAnalysis.disputeRate <= 2 ? 'bg-emerald-50 dark:bg-emerald-500/10' : profitAnalysis.disputeRate <= 5 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${profitAnalysis.disputeRate <= 2 ? 'text-emerald-500' : profitAnalysis.disputeRate <= 5 ? 'text-amber-500' : 'text-red-500'}`} />
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{t('stats.profitAnalysis.disputeRate')}</p>
            </div>
            <p className={`mt-1 text-lg font-bold ${profitAnalysis.disputeRate <= 2 ? 'text-emerald-500' : profitAnalysis.disputeRate <= 5 ? 'text-amber-500' : 'text-red-500'}`}>
              {profitAnalysis.disputeRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Performance Summary */}
        {monthlyComparison && (
          <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div>
              <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('stats.profitAnalysis.performanceSummary')}</p>
              <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {monthlyComparison.type === 'noData'
                  ? t('stats.profitAnalysis.noData')
                  : monthlyComparison.type === 'noChange'
                    ? t('stats.profitAnalysis.noChange')
                    : (
                      <span className="flex items-center gap-1">
                        {monthlyComparison.direction === 'increased'
                          ? <TrendingUp className="inline h-4 w-4 text-emerald-500" />
                          : <TrendingDown className="inline h-4 w-4 text-red-500" />}
                        {t('stats.profitAnalysis.monthlyComparison', {
                          change: monthlyComparison.change,
                          direction: t(`stats.profitAnalysis.${monthlyComparison.direction}`),
                        })}
                      </span>
                    )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Selected period order detail (drilldown) */}
      {selectedPeriod && (
        <div className="mb-6 overflow-hidden rounded-2xl border-2 border-pink-200 dark:border-pink-500/30">
          <div className="flex items-center justify-between border-b border-pink-100 bg-pink-50/50 px-5 py-4 dark:border-pink-500/20 dark:bg-pink-500/5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {t('stats.periodOrderDetail', { label: selectedPeriod.label })}
              </h2>
              <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                {selectedPeriod.from === selectedPeriod.to
                  ? selectedPeriod.from
                  : `${selectedPeriod.from} ~ ${selectedPeriod.to}`}
                {periodOrders && ` | ${t('stats.orderCount', { count: periodOrders.pagination.total })}`}
              </p>
            </div>
            <button
              onClick={() => setSelectedPeriod(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {ordersLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">{t('stats.orderListLoading')}</div>
          ) : !periodOrders?.data.length ? (
            <div className="flex flex-col items-center py-10">
              <ShoppingBag className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('stats.noOrdersInPeriod')}</p>
            </div>
          ) : (
            <>
              <PeriodSummary orders={periodOrders.data} t={t} />

              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.orderNumber')}</th>
                      <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.product')}</th>
                      <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.buyer')}</th>
                      <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.productAmount')}</th>
                      <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.margin')}</th>
                      <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.totalAmount')}</th>
                      <th className="px-5 py-2.5 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.status')}</th>
                      <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('stats.orderDate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {periodOrders.data.map((order) => {
                      const st = STATUS_MAP[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
                      return (
                        <tr key={order.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-5 py-2.5">
                            <Link to={`/seller/orders/${order.id}`} className="text-[12px] font-bold text-gray-900 hover:text-pink-500 dark:text-white dark:hover:text-pink-400">
                              {order.order_number}
                            </Link>
                          </td>
                          <td className="px-5 py-2.5">
                            <p className="max-w-[160px] truncate text-[12px] text-gray-700 dark:text-gray-300">
                              {order.first_item_title}
                              {order.item_count > 1 && <span className="text-gray-400"> +{order.item_count - 1}</span>}
                            </p>
                          </td>
                          <td className="px-5 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">{order.buyer_nickname || '-'}</td>
                          <td className="px-5 py-2.5 text-right text-[12px] text-gray-700 dark:text-gray-300">₮ {order.subtotal}</td>
                          <td className="px-5 py-2.5 text-right text-[12px] text-gray-400">₮ {order.margin_amount}</td>
                          <td className="px-5 py-2.5 text-right text-[12px] font-bold text-gray-900 dark:text-white">₮ {order.total_amount}</td>
                          <td className="px-5 py-2.5 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.color}`}>{st.label}</span>
                          </td>
                          <td className="px-5 py-2.5 text-right text-[12px] text-gray-400">
                            {new Date(order.created_at).toLocaleString('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Components ---

function SummaryCard({ label, value, sub, icon, iconBg, valueColor }: { label: string; value: string; sub: string; icon: React.ReactNode; iconBg: string; valueColor?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`mt-2 text-xl font-bold ${valueColor || 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-[12px] text-gray-400 dark:text-gray-500">{sub}</p>
    </div>
  );
}

function PeriodSummary({ orders, t }: { orders: SellerOrderSummary[]; t: (key: string) => string }) {
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const totalSubtotal = orders.reduce((sum, o) => sum + Number(o.subtotal), 0);
  const totalMargin = orders.reduce((sum, o) => sum + Number(o.margin_amount), 0);
  const totalShipping = orders.reduce((sum, o) => sum + Number(o.shipping_fee), 0);
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  const STATUS_LABEL_MAP: Record<string, string> = {
    pending_payment: t('statusMap.pendingPayment'),
    txid_submitted: t('statusMap.txidSubmitted'),
    verifying: t('statusMap.verifying'),
    payment_verified: t('statusMap.paymentVerified'),
    shipped: t('statusMap.shipped'),
    delivered: t('statusMap.delivered'),
    confirmed: t('statusMap.confirmed'),
    cancelled: t('statusMap.cancelled'),
    refunded: t('statusMap.refunded'),
    disputed: t('statusMap.disputed'),
  };

  const STATUS_COLOR_MAP: Record<string, string> = {
    pending_payment: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10',
    txid_submitted: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10',
    verifying: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10',
    payment_verified: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10',
    shipped: 'bg-pink-50 text-pink-500 dark:bg-pink-500/10',
    delivered: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    confirmed: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10',
    cancelled: 'bg-red-50 text-red-500 dark:bg-red-500/10',
    refunded: 'bg-red-50 text-red-500 dark:bg-red-500/10',
    disputed: 'bg-orange-50 text-orange-500 dark:bg-orange-500/10',
  };

  return (
    <div className="border-b border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
          <p className="text-[12px] text-gray-400">{t('stats.periodSummary.orderCount')}</p>
          <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">{orders.length}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
          <p className="text-[12px] text-gray-400">{t('stats.periodSummary.productAmount')}</p>
          <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">₮ {totalSubtotal.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
          <p className="text-[12px] text-gray-400">{t('stats.periodSummary.shippingFee')}</p>
          <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">₮ {totalShipping.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
          <p className="text-[12px] text-gray-400">{t('stats.periodSummary.marginTotal')}</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-500">₮ {totalMargin.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
          <p className="text-[12px] text-gray-400">{t('stats.periodSummary.totalSales')}</p>
          <p className="mt-0.5 text-lg font-bold text-pink-500">₮ {totalAmount.toLocaleString()}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(statusCounts).map(([status, count]) => {
          const label = STATUS_LABEL_MAP[status] ?? status;
          const color = STATUS_COLOR_MAP[status] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
          return (
            <span key={status} className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${color}`}>
              {label} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// --- Utils ---

function fmt(val?: string | number | null): string {
  return Number(val ?? 0).toLocaleString();
}

interface AggregatedSales extends DailySales {
  dateFrom: string;
  dateTo: string;
  label: string;
  chartLabel: string;
}

function aggregateWeekly(daily: DailySales[]): AggregatedSales[] {
  const weeks: Map<string, AggregatedSales> = new Map();

  for (const d of daily) {
    const date = new Date(d.date);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const key = monday.toISOString().slice(0, 10);
    const existing = weeks.get(key);

    if (existing) {
      existing.order_count += d.order_count;
      existing.total_amount = String(Number(existing.total_amount) + Number(d.total_amount));
      if (d.date > existing.dateTo) existing.dateTo = d.date;
    } else {
      weeks.set(key, {
        date: key,
        dateFrom: key,
        dateTo: d.date,
        order_count: d.order_count,
        total_amount: d.total_amount,
        label: `${monday.getMonth() + 1}/${monday.getDate()} ~ ${sunday.getMonth() + 1}/${sunday.getDate()}`,
        chartLabel: `${monday.getMonth() + 1}/${monday.getDate()}`,
      });
    }
  }

  return Array.from(weeks.values()).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
}

function aggregateMonthly(daily: DailySales[]): AggregatedSales[] {
  const months: Map<string, AggregatedSales> = new Map();

  for (const d of daily) {
    const date = new Date(d.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = months.get(key);

    if (existing) {
      existing.order_count += d.order_count;
      existing.total_amount = String(Number(existing.total_amount) + Number(d.total_amount));
      if (d.date < existing.dateFrom) existing.dateFrom = d.date;
      if (d.date > existing.dateTo) existing.dateTo = d.date;
    } else {
      months.set(key, {
        date: key,
        dateFrom: d.date,
        dateTo: d.date,
        order_count: d.order_count,
        total_amount: d.total_amount,
        label: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        chartLabel: `${date.getMonth() + 1}`,
      });
    }
  }

  return Array.from(months.values()).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
}
