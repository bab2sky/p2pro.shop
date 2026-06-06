import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreditCard, AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { getOrder, submitTxid, updatePaymentNetwork, getAvailablePaymentNetworks } from '@/lib/api/orders';
import { PaymentGuide } from '@/components/order/PaymentGuide';

export default function PaymentPage() {
  const { t } = useTranslation();
  const NETWORKS = [
    { id: 'TRC-20', label: 'TRC-20', desc: t('order.payment.page.networkDescTrc20', 'TRON (낮은 수수료)'), color: 'bg-red-500' },
    { id: 'ERC-20', label: 'ERC-20', desc: t('order.payment.page.networkDescErc20', 'Ethereum (높은 보안)'), color: 'bg-blue-500' },
    { id: 'BEP-20', label: 'BEP-20', desc: t('order.payment.page.networkDescBep20', 'BNB Chain (낮은 수수료)'), color: 'bg-yellow-500' },
  ] as const;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [txid, setTxid] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const { data: availableNetworks } = useQuery({
    queryKey: ['payment-networks'],
    queryFn: getAvailablePaymentNetworks,
    staleTime: 60_000,
  });

  const txidMutation = useMutation({
    mutationFn: () => submitTxid(id!, txid),
    onSuccess: () => {
      toast.success(t('order.payment.page.submitSuccess', 'TXID가 접수되었습니다. 관리자 확인 후 결제가 완료됩니다.'));
      navigate(`/orders/${id}`);
    },
  });

  const networkMutation = useMutation({
    mutationFn: (network: string) => updatePaymentNetwork(id!, network),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success(t('order.payment.page.networkChanged', '결제 네트워크가 변경되었습니다.'));
    },
    onError: () => {
      toast.error(t('order.payment.page.networkChangeFail', '네트워크 변경에 실패했습니다.'));
    },
  });

  // 주문에 저장된 네트워크가 사용 불가하면 첫 번째 사용 가능 네트워크로 자동 전환
  // (관리자가 해당 네트워크의 지갑을 제거한 경우 등)
  // NOTE: Hook은 early return 위에 있어야 함 (Rules of Hooks)
  useEffect(() => {
    if (!order || !availableNetworks || availableNetworks.length === 0) return;
    if (!order.payment_network) return;
    if (availableNetworks.includes(order.payment_network)) return;
    if (networkMutation.isPending) return;
    networkMutation.mutate(availableNetworks[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableNetworks, order?.payment_network]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center py-16">
        <CreditCard className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-bold text-gray-400">{t('order.payment.page.orderNotFound', '주문을 찾을 수 없습니다.')}</p>
      </div>
    );
  }

  if (order.status !== 'pending_payment') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-gray-300 bg-white p-8 dark:border-gray-600 dark:bg-gray-900">
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('order.payment.page.alreadyProcessed', '이미 결제가 처리된 주문입니다.')}</p>
          <button
            onClick={() => navigate(`/orders/${id}`)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('order.payment.page.viewOrderDetail', '주문 상세 보기')}
          </button>
        </div>
      </div>
    );
  }

  const currentNetwork = order.payment_network || availableNetworks?.[0] || 'TRC-20';
  const isAvailable = (id: string) => !availableNetworks || availableNetworks.includes(id);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6" role="main" aria-label={t('order.payment.page.ariaLabel', 'USDT 에스크로 결제')}>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 dark:bg-white">
          <CreditCard className="h-7 w-7 text-white dark:text-gray-900" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('order.payment.page.title', 'USDT 에스크로 결제')}</h1>
      </div>

      <div className="rounded-2xl border border-gray-300 bg-white p-4 text-center dark:border-gray-600 dark:bg-gray-900">
        <p className="text-[12px] font-bold text-gray-400">{t('order.payment.page.orderNumber', '주문번호')}</p>
        <p className="mt-0.5 font-mono text-[13px] text-gray-900 dark:text-white">{order.order_number}</p>
      </div>

      {/* Network Selector */}
      <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
        <h2 className="mb-3 text-[14px] font-bold text-gray-900 dark:text-white">{t('order.payment.page.selectNetwork', '결제 네트워크 선택')}</h2>
        <div className="flex gap-2">
          {NETWORKS.map((net) => {
            const enabled = isAvailable(net.id);
            const selected = currentNetwork === net.id && enabled;
            return (
              <button
                key={net.id}
                type="button"
                disabled={networkMutation.isPending || !enabled}
                title={enabled ? net.label : t('order.payment.page.networkNotConfigured', { network: net.label, defaultValue: '{{network}} (지갑 미설정)' })}
                onClick={() => {
                  if (enabled && net.id !== currentNetwork) networkMutation.mutate(net.id);
                }}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-3 text-center transition-all ${
                  selected
                    ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                    : enabled
                      ? 'border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                      : 'cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${net.color}`} />
                  <span className="text-[13px] font-bold">{net.label}</span>
                </div>
                <span className={`text-[10px] ${selected ? 'text-gray-300 dark:text-gray-500' : 'text-gray-400'}`}>
                  {net.desc}
                </span>
              </button>
            );
          })}
        </div>
        {networkMutation.isPending && (
          <p className="mt-2 text-center text-[11px] text-gray-400">{t('order.payment.page.networkSwitching', '네트워크 변경 중...')}</p>
        )}
      </div>

      <PaymentGuide
        walletAddress={order.company_wallet}
        totalAmount={order.total_amount}
        deadline={order.txid_deadline}
        paymentNetwork={currentNetwork}
      />

      {/* TXID input */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('order.payment.page.txidLabel', 'TXID 입력')}</h2>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            {t('order.payment.page.txidGuide', 'MetaMask 등에서 USDT 전송 후 Transaction ID(TXID)를 아래에 입력하세요.')}
          </p>
          <input
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            aria-label={t('order.payment.page.txidLabel', 'TXID 입력')}
            placeholder={currentNetwork === 'TRC-20' ? t('order.payment.page.txidPlaceholderTrc', '트랜잭션 해시를 입력하세요') : '0x...'}
            className="w-full rounded-xl bg-gray-100 px-4 py-2.5 font-mono text-[13px] font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100"
          />
          {/* TXID 제출 중복 클릭 방어 — disabled + idempotent guard */}
          <button
            onClick={() => {
              if (txidMutation.isPending) return;
              txidMutation.mutate();
            }}
            disabled={txidMutation.isPending || txid.length < 64 || txid.length > 66}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-3 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Send className="h-4 w-4" />
            {txidMutation.isPending ? t('order.payment.page.submitting', '제출 중...') : t('order.payment.page.submitButton', 'TXID 제출')}
          </button>
          {txidMutation.isError && (
            <div role="alert" className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
              <AlertCircle className="h-4 w-4" />
              {t('order.payment.page.submitFail', 'TXID 제출에 실패했습니다. 형식을 확인해주세요.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
