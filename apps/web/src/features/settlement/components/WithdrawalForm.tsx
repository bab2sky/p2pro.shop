import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  AlertCircle,
  Wallet,
  Shield,
  Info,
} from 'lucide-react';
import { createWithdrawal, getSettlementSummary } from '@/lib/api/settlements';
import { getMySellerProfile } from '@/lib/api/seller';
import { extractApiError } from '@/lib/api-error';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export function WithdrawalForm() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  // v1.3.10 — 지갑/네트워크는 SellerSettings 에서 등록한 BEP-20 주소를
  // 그대로 사용. 폼에서 자유 입력 불가 (보내는 곳을 한 군데로 강제해서
  // 잘못된 주소 출금 사고 차단).
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');

  const { data: summaryData } = useQuery({
    queryKey: ['settlement', 'summary'],
    queryFn: () => getSettlementSummary().then((r) => r.data),
  });

  const { data: profileData } = useQuery({
    queryKey: ['sellerProfile'],
    queryFn: getMySellerProfile,
  });
  const seller = profileData?.data;
  const walletAddress = seller?.wallet_address ?? '';
  const walletLocked = !!seller?.wallet_locked;
  const network = 'bep20';

  const mutation = useMutation({
    mutationFn: createWithdrawal,
    onSuccess: () => {
      setAmount('');
      setTotpCode('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['settlement'] });
    },
    onError: (err: unknown) => {
      setError(extractApiError(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('유효한 금액을 입력하세요.');
      return;
    }

    if (summaryData) {
      const available = parseFloat(summaryData.available_amount);
      if (amountNum > available) {
        setError(`출금 가능 금액을 초과했습니다. (출금 가능: $${summaryData.available_amount})`);
        return;
      }
    }

    if (!walletAddress) {
      setError('등록된 BEP-20 지갑 주소가 없습니다. /seller/settings 에서 먼저 등록하세요.');
      return;
    }

    if (!totpCode.trim() || totpCode.length !== 6) {
      setError('6자리 2FA 인증 코드를 입력하세요.');
      return;
    }

    mutation.mutate({ amount, wallet_address: walletAddress, network, totp_code: totpCode });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
          <Send className="h-4 w-4" />
          출금 신청
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">출금 금액 (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
            required
          />
          {summaryData && (
            <p className="mt-1.5 text-[12px] text-gray-400">
              출금 가능: <span className="font-bold text-pink-500">${summaryData.available_amount}</span>
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-gray-500 dark:text-gray-400">
            <Wallet className="h-3 w-3" />
            지갑 주소 (BEP-20)
            {walletLocked && (
              <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500 dark:bg-red-500/10">
                잠금
              </span>
            )}
          </label>
          {walletAddress ? (
            <div className={`${inputClass} font-mono text-[13px] cursor-not-allowed select-all break-all`}>
              {walletAddress}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>등록된 지갑이 없습니다. <a href="/seller/settings" className="font-bold underline">설정 페이지</a>에서 BEP-20 지갑 주소를 먼저 등록하세요.</span>
            </div>
          )}
          <p className="mt-1.5 flex items-start gap-1 text-[11px] text-gray-400">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span>지갑 주소는 /seller/settings 에서 한 번만 등록 가능하며 변경할 수 없습니다.</span>
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">네트워크</label>
          <div className={`${inputClass} font-bold text-center`}>
            BEP20 (BNB Smart Chain)
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-gray-500 dark:text-gray-400">
            <Shield className="h-3 w-3" />
            2FA 인증 코드
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6자리 인증 코드"
            className={`${inputClass} text-center tracking-[0.5em]`}
            required
          />
          <p className="mt-1.5 text-[11px] text-gray-400">
            출금 시 2FA 인증이 필요합니다.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          <Send className="h-3.5 w-3.5" />
          {mutation.isPending ? '처리중...' : '출금 신청'}
        </button>
      </form>
    </div>
  );
}
