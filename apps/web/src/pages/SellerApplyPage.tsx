import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Store,
  User,
  Building2,
  Wallet,
  Phone,
  AlertCircle,
} from 'lucide-react';
import { applySeller } from '@/lib/api/seller';
import { SimplePageHeader } from '@/components/layout/SimplePageHeader';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function SellerApplyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    seller_type: 'individual' as 'individual' | 'business',
    wallet_address: '',
    contact_phone: '',
  });

  const mutation = useMutation({
    mutationFn: () => applySeller(form),
    onSuccess: () => {
      toast.success('판매자 신청이 접수되었습니다.');
      navigate('/');
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <SimplePageHeader />

      {/* Center content */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 dark:bg-white">
              <Store className="h-7 w-7 text-white dark:text-gray-900" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">판매자 신청</h1>
            <p className="mt-1 text-[13px] text-gray-400">P2PRO 마켓에서 상품을 판매해보세요</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-[12px] font-bold text-gray-500 dark:text-gray-400">사업자 유형</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, seller_type: 'individual' })}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                      form.seller_type === 'individual'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    개인
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, seller_type: 'business' })}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                      form.seller_type === 'business'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    사업자
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-gray-500 dark:text-gray-400">
                  <Wallet className="h-3 w-3" />
                  USDT 지갑 주소
                </label>
                <input
                  value={form.wallet_address}
                  onChange={(e) => setForm({ ...form, wallet_address: e.target.value })}
                  placeholder="USDT 지갑 주소를 입력하세요"
                  className={`${inputClass} font-mono text-[13px]`}
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-gray-500 dark:text-gray-400">
                  <Phone className="h-3 w-3" />
                  연락처
                </label>
                <input
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className={inputClass}
                />
              </div>

              {mutation.isError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  신청에 실패했습니다.
                </div>
              )}

              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !form.wallet_address}
                className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-3 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                <Store className="h-4 w-4" />
                {mutation.isPending ? '신청 중...' : '판매자 신청'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
