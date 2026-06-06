import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  User,
  Building2,
  Phone,
  ShoppingBag,
  Star,
  MessageCircle,
  Truck,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Pencil,
  Info,
  Shield,
  Loader2,
} from 'lucide-react';
import { getMySellerProfile, updateSellerProfile, submitDeposit, getDepositStatus } from '@/lib/api/seller';
import { useAuthStore } from '@/stores/auth';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

const getStatusConfig = (t: (key: string) => string): Record<string, { label: string; icon: typeof CheckCircle; style: string }> => ({
  approved: { label: t('settingsPage.statusApproved'), icon: CheckCircle, style: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
  pending: { label: t('settingsPage.statusPending'), icon: Clock, style: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' },
  rejected: { label: t('settingsPage.statusRejected'), icon: XCircle, style: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
  suspended: { label: t('settingsPage.statusSuspended'), icon: XCircle, style: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
});

export default function SellerSettingsPage() {
  const { t } = useTranslation('seller');
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['sellerProfile'],
    queryFn: getMySellerProfile,
  });

  // Deposit state & queries
  const { data: depositData, isLoading: depositLoading } = useQuery({
    queryKey: ['sellerDepositStatus'],
    queryFn: getDepositStatus,
  });
  const [depositTxid, setDepositTxid] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNetwork, setDepositNetwork] = useState<'trc20' | 'erc20'>('trc20');

  const depositMut = useMutation({
    mutationFn: () => submitDeposit({ txid: depositTxid.trim(), amount: parseFloat(depositAmount), network: depositNetwork }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerDepositStatus'] });
      setDepositTxid('');
      setDepositAmount('');
    },
  });

  const [editSection, setEditSection] = useState<'none' | 'basic' | 'business' | 'contact'>('none');

  // v1.3.10 — BEP-20 지갑 등록 (한 번 등록 후 변경 불가)
  const [walletInput, setWalletInput] = useState('');
  const [walletError, setWalletError] = useState('');
  const isValidBep20 = /^0x[a-fA-F0-9]{40}$/.test(walletInput.trim());

  const walletMut = useMutation({
    mutationFn: (addr: string) => updateSellerProfile({ wallet_address: addr }),
    onMutate: () => setWalletError(''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerProfile'] });
      setWalletInput('');
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setWalletError(err.response?.data?.error?.message ?? '지갑 등록에 실패했습니다.');
    },
  });

  const [sellerType, setSellerType] = useState<'individual' | 'business'>('individual');
  const [businessName, setBusinessName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const updateMut = useMutation({
    mutationFn: updateSellerProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerProfile'] });
      setEditSection('none');
    },
  });

  const seller = profileData?.data;

  useEffect(() => {
    if (seller) {
      setSellerType(seller.seller_type === 'business' ? 'business' : 'individual');
      setBusinessName(seller.business_name || '');
      setBusinessNumber(seller.business_number || '');
      setRepresentativeName(seller.representative_name || '');
      setBusinessAddress(seller.business_address || '');
      setBusinessType(seller.business_type || '');
      setBusinessCategory(seller.business_category || '');
      setContactPhone(seller.contact_phone || '');
    }
  }, [seller]);

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 120 }} />
        ))}
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="flex flex-col items-center py-16">
        <Settings className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('settingsPage.notFound')}</p>
      </div>
    );
  }

  const STATUS_CONFIG = getStatusConfig(t);
  const statusCfg = STATUS_CONFIG[seller.status ?? ''] ?? { label: seller.status, icon: Clock, style: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
  const StatusIcon = statusCfg.icon;
  const isBusiness = seller.seller_type === 'business';
  const hasBusinessInfo = !!(seller.business_number && seller.business_name);

  const startEdit = (section: 'basic' | 'business' | 'contact') => {
    if (seller) {
      setSellerType(seller.seller_type === 'business' ? 'business' : 'individual');
      setBusinessName(seller.business_name || '');
      setBusinessNumber(seller.business_number || '');
      setRepresentativeName(seller.representative_name || '');
      setBusinessAddress(seller.business_address || '');
      setBusinessType(seller.business_type || '');
      setBusinessCategory(seller.business_category || '');
      setContactPhone(seller.contact_phone || '');
    }
    setEditSection(section);
  };

  const handleSaveBasic = () => updateMut.mutate({ seller_type: sellerType });
  const handleSaveBusiness = () => updateMut.mutate({
    seller_type: 'business',
    business_name: businessName,
    business_number: businessNumber,
    representative_name: representativeName,
    business_address: businessAddress,
    business_type: businessType,
    business_category: businessCategory,
  });
  const handleSaveContact = () => updateMut.mutate({ contact_phone: contactPhone });

  const formatBizNumber = (val: string) => {
    const nums = val.replace(/\D/g, '').slice(0, 10);
    if (nums.length <= 3) return nums;
    if (nums.length <= 5) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 5)}-${nums.slice(5)}`;
  };

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-[12px] font-bold text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{value || '-'}</p>
    </div>
  );

  const depositSub = depositData?.submission;
  const requiredDepositAmount = depositData?.required_amount ?? '0';
  const isDepositVerified = depositSub?.status === 'verified';
  const isDepositPending = depositSub?.status === 'pending';

  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('settingsPage.title')}</h1>

      {/* v1.3.10 — BEP-20 지갑 등록 / 잠금 (한 번 등록하면 변경 불가) */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Shield className="h-4 w-4" />
            출금 지갑 (BEP-20)
          </h2>
          {seller.wallet_locked && (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold text-red-500 dark:bg-red-500/10">
              <CheckCircle className="h-3 w-3" />
              잠금
            </span>
          )}
        </div>
        <div className="p-5 space-y-3">
          {seller.wallet_locked && seller.wallet_address ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">등록된 지갑 주소</p>
              <p className="break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                {seller.wallet_address}
              </p>
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>한 번 등록한 지갑 주소는 수정할 수 없습니다. /seller/settlement 출금 시 이 주소로 송금됩니다.</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                정산금 출금 시 사용할 BNB Smart Chain (BEP-20) USDT 지갑 주소를 등록하세요.
              </p>
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>한 번 등록한 지갑 주소는 수정할 수 없습니다. 정확한 주소인지 다시 한 번 확인해주세요.</span>
              </p>
              <input
                type="text"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="0x..."
                className={inputClass}
              />
              {walletInput && !isValidBep20 && (
                <p className="text-xs text-red-500">BEP-20 주소는 0x 로 시작하는 42자리(0x + 40자리 16진수) 입니다.</p>
              )}
              {walletError && <p className="text-xs text-red-500">{walletError}</p>}
              <button
                type="button"
                disabled={!isValidBep20 || walletMut.isPending}
                onClick={() => walletMut.mutate(walletInput.trim())}
                className="w-full rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2.5 text-sm font-bold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {walletMut.isPending ? '등록 중…' : '등록 (이후 변경 불가)'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Deposit Section (Gap 1: FR-06) */}
      {parseFloat(requiredDepositAmount) > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <Shield className="h-4 w-4" />
              {t('settingsPage.deposit.title')}
            </h2>
            {isDepositVerified && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-500 dark:bg-emerald-500/10">
                <CheckCircle className="h-3 w-3" />
                {t('settingsPage.deposit.verified')}
              </span>
            )}
          </div>
          <div className="p-5">
            {depositLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : isDepositVerified ? (
              <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {t('settingsPage.deposit.verifiedAmount', { amount: depositSub?.amount ?? '0' })}
                </p>
                <p className="mt-1 text-[12px] text-emerald-600 dark:text-emerald-500">
                  TXID: <span className="font-mono">{depositSub?.txid}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settingsPage.deposit.requiredAmount', { amount: requiredDepositAmount })}
                  </p>
                  <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                    {t('settingsPage.deposit.description')}
                  </p>
                </div>

                {/* Show current status if pending or rejected */}
                {depositSub && (
                  <div className={`rounded-xl p-4 ${
                    isDepositPending
                      ? 'bg-amber-50 dark:bg-amber-500/10'
                      : depositSub.status === 'rejected'
                        ? 'bg-red-50 dark:bg-red-500/10'
                        : depositSub.status === 'refund_pending'
                          ? 'bg-purple-50 dark:bg-purple-500/10'
                          : 'bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <p className={`text-sm font-medium ${
                      isDepositPending ? 'text-amber-700 dark:text-amber-400' :
                      depositSub.status === 'rejected' ? 'text-red-700 dark:text-red-400' :
                      depositSub.status === 'refund_pending' ? 'text-purple-700 dark:text-purple-400' :
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      {isDepositPending ? t('settingsPage.deposit.pendingStatus') :
                       depositSub.status === 'rejected' ? t('settingsPage.deposit.rejectedStatus') :
                       depositSub.status === 'refund_pending' ? t('settingsPage.deposit.refundPendingStatus') :
                       depositSub.status === 'refunded' ? t('settingsPage.deposit.refundedStatus') :
                       depositSub.status}
                    </p>
                    {depositSub.admin_note && (
                      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                        {t('settingsPage.deposit.adminNote')}: {depositSub.admin_note}
                      </p>
                    )}
                    <p className="mt-1 text-[12px] text-gray-400">
                      TXID: <span className="font-mono">{depositSub.txid}</span>
                    </p>
                  </div>
                )}

                {/* Submit form (only if no pending deposit) */}
                {!isDepositPending && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">TXID <span className="text-red-500">*</span></label>
                      <input
                        value={depositTxid}
                        onChange={(e) => setDepositTxid(e.target.value)}
                        className={`${inputClass} font-mono text-[13px]`}
                        placeholder={t('settingsPage.deposit.txidPlaceholder')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.deposit.amount')} <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className={inputClass}
                          placeholder={requiredDepositAmount}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.deposit.network')}</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDepositNetwork('trc20')}
                            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                              depositNetwork === 'trc20'
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            TRC-20
                          </button>
                          <button
                            type="button"
                            onClick={() => setDepositNetwork('erc20')}
                            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                              depositNetwork === 'erc20'
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            ERC-20
                          </button>
                        </div>
                      </div>
                    </div>
                    {depositMut.isError && (
                      <p className="text-center text-[13px] text-red-500">{t('settingsPage.deposit.submitError')}</p>
                    )}
                    <button
                      onClick={() => depositMut.mutate()}
                      disabled={depositMut.isPending || !depositTxid.trim() || !depositAmount || parseFloat(depositAmount) <= 0}
                      className="w-full rounded-full bg-gray-900 py-3 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      {depositMut.isPending ? t('settingsPage.deposit.submitting') : t('settingsPage.deposit.submit')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <User className="h-4 w-4" />
            {t('settingsPage.basicInfo')}
          </h2>
          {editSection !== 'basic' && (
            <button onClick={() => startEdit('basic')} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
              <Pencil className="h-3 w-3" />
              {t('settingsPage.edit')}
            </button>
          )}
        </div>
        <div className="p-5">
          {editSection === 'basic' ? (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.sellerType')}</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSellerType('individual')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                      sellerType === 'individual'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    {t('settingsPage.individual')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellerType('business')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                      sellerType === 'business'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    {t('settingsPage.business')}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditSection('none')} className="rounded-full bg-gray-100 px-5 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">{t('settingsPage.cancel')}</button>
                <button onClick={handleSaveBasic} disabled={updateMut.isPending} className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                  {updateMut.isPending ? t('settingsPage.saving') : t('settingsPage.save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InfoRow label={t('settingsPage.storeName')} value={user?.nickname || '-'} />
              <div>
                <p className="text-[12px] font-bold text-gray-400">{t('settingsPage.sellerType')}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-lg text-[10px] font-bold ${
                    isBusiness
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {isBusiness ? 'B' : 'P'}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{isBusiness ? t('settingsPage.business') : t('settingsPage.individualShort')}</span>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-400">{t('settingsPage.status')}</p>
                <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusCfg.style}`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusCfg.label}
                </span>
              </div>
              <InfoRow label={t('settingsPage.joinDate')} value={seller.created_at ? new Date(seller.created_at).toLocaleDateString('ko') : '-'} />
            </div>
          )}
        </div>
      </div>

      {/* Business Info */}
      {(isBusiness || (editSection === 'basic' && sellerType === 'business')) && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                <Building2 className="h-4 w-4" />
                {t('settingsPage.businessInfo')}
              </h2>
              {!hasBusinessInfo && isBusiness && (
                <span className="flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-500 dark:bg-red-500/10">
                  <AlertTriangle className="h-3 w-3" />
                  {t('settingsPage.notRegistered')}
                </span>
              )}
              {hasBusinessInfo && (
                <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-500 dark:bg-emerald-500/10">
                  <CheckCircle className="h-3 w-3" />
                  {t('settingsPage.registered')}
                </span>
              )}
            </div>
            {editSection !== 'business' && (
              <button onClick={() => startEdit('business')} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
                <Pencil className="h-3 w-3" />
                {hasBusinessInfo ? t('settingsPage.edit') : t('settingsPage.register')}
              </button>
            )}
          </div>
          <div className="p-5">
            {editSection === 'business' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.bizNumber')} <span className="text-red-500">*</span></label>
                    <input value={businessNumber} onChange={(e) => setBusinessNumber(formatBizNumber(e.target.value))} className={inputClass} placeholder="000-00-00000" maxLength={12} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.bizName')} <span className="text-red-500">*</span></label>
                    <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} placeholder={t('settingsPage.bizNamePlaceholder')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.representative')} <span className="text-red-500">*</span></label>
                    <input value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} className={inputClass} placeholder={t('settingsPage.representativePlaceholder')} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.bizType')}</label>
                    <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} placeholder={t('settingsPage.bizTypePlaceholder')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.bizCategory')}</label>
                    <input value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} className={inputClass} placeholder={t('settingsPage.bizCategoryPlaceholder')} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.bizAddress')}</label>
                    <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className={inputClass} placeholder={t('settingsPage.bizAddressPlaceholder')} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditSection('none')} className="rounded-full bg-gray-100 px-5 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">{t('settingsPage.cancel')}</button>
                  <button
                    onClick={handleSaveBusiness}
                    disabled={updateMut.isPending || !businessNumber || !businessName || !representativeName}
                    className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    {updateMut.isPending ? t('settingsPage.saving') : t('settingsPage.save')}
                  </button>
                </div>
                {updateMut.isError && editSection === 'business' && (
                  <p className="text-center text-[13px] text-red-500">{t('settingsPage.saveError')}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <InfoRow label={t('settingsPage.bizNumber')} value={seller.business_number || '-'} />
                <InfoRow label={t('settingsPage.bizName')} value={seller.business_name || '-'} />
                <InfoRow label={t('settingsPage.representative')} value={seller.representative_name || '-'} />
                <InfoRow label={t('settingsPage.bizType')} value={seller.business_type || '-'} />
                <InfoRow label={t('settingsPage.bizCategory')} value={seller.business_category || '-'} />
                <InfoRow label={t('settingsPage.bizAddress')} value={seller.business_address || '-'} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settlement Info */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Info className="h-4 w-4" />
            {t('settingsPage.settlementGuide')}
          </h2>
        </div>
        <div className="p-5">
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <p className="mb-3 text-[12px] font-bold text-gray-900 dark:text-white">{t('settingsPage.settlementProcess')}</p>
            <ol className="space-y-2 text-[13px] text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">1</span>
                {t('settingsPage.settlementStep1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">2</span>
                {t('settingsPage.settlementStep2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">3</span>
                {t('settingsPage.settlementStep3')}
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">4</span>
                {t('settingsPage.settlementStep4')}
              </li>
            </ol>
          </div>
          <p className="mt-3 text-[11px] text-gray-400">
            {t('settingsPage.settlementNote')}
          </p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Phone className="h-4 w-4" />
            {t('settingsPage.contactInfo')}
          </h2>
          {editSection !== 'contact' && (
            <button onClick={() => startEdit('contact')} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
              <Pencil className="h-3 w-3" />
              {t('settingsPage.edit')}
            </button>
          )}
        </div>
        <div className="p-5">
          {editSection === 'contact' ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('settingsPage.phone')}</label>
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} placeholder={t('settingsPage.phonePlaceholder')} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditSection('none')} className="rounded-full bg-gray-100 px-5 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">{t('settingsPage.cancel')}</button>
                <button onClick={handleSaveContact} disabled={updateMut.isPending} className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                  {updateMut.isPending ? t('settingsPage.saving') : t('settingsPage.save')}
                </button>
              </div>
              {updateMut.isError && editSection === 'contact' && (
                <p className="text-center text-[13px] text-red-500">{t('settingsPage.saveError')}</p>
              )}
            </div>
          ) : (
            <InfoRow label={t('settingsPage.phone')} value={seller.contact_phone || '-'} />
          )}
        </div>
      </div>

      {/* Sales Performance */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <ShoppingBag className="h-4 w-4" />
            {t('settingsPage.salesPerformance')}
          </h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: t('settingsPage.totalSales'), value: `${seller.total_sales ?? 0}`, icon: ShoppingBag, color: 'text-gray-500' },
              { label: t('settingsPage.avgRating'), value: seller.avg_rating ?? '-', icon: Star, color: 'text-amber-500' },
              { label: t('settingsPage.responseRate'), value: `${seller.response_rate ?? '-'}%`, icon: MessageCircle, color: 'text-emerald-500' },
              { label: t('settingsPage.avgShipDays'), value: `${seller.avg_ship_days ?? '-'}`, icon: Truck, color: 'text-gray-500' },
              { label: t('settingsPage.gradeLabel'), value: `Lv.${seller.grade ?? 1}`, icon: Award, color: 'text-pink-500' },
              { label: t('settingsPage.disputes'), value: `${seller.dispute_count ?? 0}`, icon: AlertTriangle, color: 'text-red-500' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
                <stat.icon className={`mx-auto mb-1.5 h-4 w-4 ${stat.color}`} />
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-[11px] font-medium text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Success toast */}
      {updateMut.isSuccess && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-lg dark:bg-white dark:text-gray-900">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          {t('settingsPage.saved')}
        </div>
      )}
    </div>
  );
}
