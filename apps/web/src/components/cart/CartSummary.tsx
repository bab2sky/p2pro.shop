import { useTranslation } from 'react-i18next';

interface CartSummaryProps {
  grandTotal: number;
  onCheckout: () => void;
}

export function CartSummary({ grandTotal, onCheckout }: CartSummaryProps) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold text-gray-900 dark:text-white">{t('cart.summary.grandTotal', '총 결제금액')}</span>
        <span className="text-xl font-bold text-pink-500">₮ {grandTotal.toFixed(2)} <span className="text-sm font-medium text-gray-400">USDT</span></span>
      </div>
      <button
        onClick={onCheckout}
        className="mt-4 w-full rounded-full bg-gray-900 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        {t('cart.summary.checkout', '주문하기')}
      </button>
    </div>
  );
}
