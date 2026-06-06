import { useTranslation } from 'react-i18next';
import { SettlementSummary, WithdrawalForm, WithdrawalTable } from '@/features/settlement';

export default function SellerSettlementPage() {
  const { t } = useTranslation('seller');
  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('settlementPage.title')}</h1>
      <SettlementSummary />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <WithdrawalForm />
        </div>
        <div className="lg:col-span-2">
          <WithdrawalTable />
        </div>
      </div>
    </div>
  );
}
