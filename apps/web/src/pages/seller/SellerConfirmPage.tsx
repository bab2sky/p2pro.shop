import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  Clock,
  Info,
  ShoppingBag,
} from 'lucide-react';
import { getSellerOrders, type SellerOrderSummary } from '@/lib/api/orders';

export default function SellerConfirmPage() {
  const { t } = useTranslation('seller');
  const [activeTab, setActiveTab] = useState('delivered');

  const TABS = [
    { value: 'delivered', label: t('confirmPage.tabDelivered'), icon: <Clock className="h-3.5 w-3.5" /> },
    { value: 'confirmed', label: t('confirmPage.tabConfirmed'), icon: <CheckCircle className="h-3.5 w-3.5" /> },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['sellerOrders', 'confirm', activeTab],
    queryFn: () => getSellerOrders({ per_page: 100, status: activeTab }),
  });

  const orders = data?.data ?? [];

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">{t('confirmPage.title')}</h1>

      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-purple-50 p-4 dark:bg-purple-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
        <p className="text-sm text-purple-700 dark:text-purple-400">
          {t('confirmPage.autoConfirmNote')}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 60 }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <ShoppingBag className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('confirmPage.noOrders')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-5 py-3 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('confirmPage.orderNumber')}</th>
                <th className="px-5 py-3 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('confirmPage.product')}</th>
                <th className="px-5 py-3 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('confirmPage.amount')}</th>
                <th className="px-5 py-3 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('confirmPage.statusLabel')}</th>
                <th className="px-5 py-3 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('confirmPage.orderDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map((order: SellerOrderSummary) => (
                <tr key={order.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3">
                    <Link to={`/seller/orders/${order.id}`} className="text-sm font-bold text-gray-900 hover:text-pink-500 dark:text-white dark:hover:text-pink-400">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {order.first_item_title}
                      {order.item_count > 1 && <span className="text-gray-400"> {t('confirmPage.otherItems', { count: order.item_count - 1 })}</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">₮ {order.total_amount}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      order.status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                        : 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'
                    }`}>
                      {order.status === 'confirmed' ? t('confirmPage.statusConfirmed') : t('confirmPage.statusWaiting')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-[12px] text-gray-400">{new Date(order.created_at).toLocaleDateString('ko')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
