import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { getSellerPnLStatement, type PnLStatement as PnLStatementType } from '@/lib/api/profit';
import { fmt } from './profitUtils';

export default function PnLStatementTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sellerPnL', from, to],
    queryFn: () => getSellerPnLStatement({ from, to }),
  });

  if (isLoading) return <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 400 }} />;

  const pnl: PnLStatementType | undefined = data?.data;
  if (!pnl) {
    return (
      <div className="flex flex-col items-center py-16">
        <FileText className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">데이터가 없습니다.</p>
      </div>
    );
  }

  const rows: { label: string; value: string; bold?: boolean; indent?: boolean; section?: boolean }[] = [
    { label: '매출', value: '', section: true },
    { label: '총매출', value: pnl.revenue.gross_sales },
    { label: '환불 차감', value: pnl.revenue.refunds, indent: true },
    { label: '순매출', value: pnl.revenue.net_revenue, bold: true },
    { label: '매출원가', value: '', section: true },
    { label: '상품 원가', value: pnl.cost_of_goods.base_cost, indent: true },
    { label: '배송비', value: pnl.cost_of_goods.shipping_cost, indent: true },
    { label: '매출원가 합계', value: pnl.cost_of_goods.total_cogs, bold: true },
    { label: '매출총이익', value: pnl.gross_profit, bold: true },
    { label: '운영비', value: '', section: true },
    { label: '플랫폼 수수료', value: pnl.operating_expenses.commission, indent: true },
    { label: '쿠폰 할인', value: pnl.operating_expenses.coupon_discounts, indent: true },
    { label: '운영비 합계', value: pnl.operating_expenses.total_opex, bold: true },
    { label: '순이익', value: pnl.net_income.net_income, bold: true },
    { label: '순이익률', value: `${fmt(pnl.net_income.net_margin_pct)}%`, bold: true },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          손익계산서
          <span className="ml-2 text-[12px] font-medium text-gray-400">{pnl.period_start} ~ {pnl.period_end}</span>
        </h3>
      </div>
      <div className="p-5">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={
                  r.section
                    ? ''
                    : r.bold
                      ? 'border-t border-gray-200 dark:border-gray-700'
                      : 'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }
              >
                <td className={`py-2.5 ${r.indent ? 'pl-6' : 'pl-2'} ${
                  r.section
                    ? 'text-[11px] font-bold uppercase tracking-wider text-gray-400'
                    : r.bold
                      ? 'font-bold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {r.label}
                </td>
                <td className={`py-2.5 pr-2 text-right ${
                  r.bold
                    ? 'font-bold text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {r.value && !r.section ? (r.label === '순이익' ? <span className="text-pink-500">{fmt(r.value)}</span> : fmt(r.value)) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
