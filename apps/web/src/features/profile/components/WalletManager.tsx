import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { getWallets, addWallet, deleteWallet, requestWalletChange } from '@/lib/api/profile';
import type { UserWallet } from '@/lib/api/profile';
import { extractApiError } from '@/lib/api-error';
import { useAuthStore } from '@/features/auth/store';

export function WalletManager() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const is2faEnabled = user?.is_2fa_enabled ?? false;

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [network, setNetwork] = useState<'ERC20' | 'TRC20'>('TRC20');
  const [address, setAddress] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const [deleteCode, setDeleteCode] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [changeModal, setChangeModal] = useState<UserWallet | null>(null);
  const [changeName, setChangeName] = useState('');
  const [changePhone, setChangePhone] = useState('');
  const [changeNewAddress, setChangeNewAddress] = useState('');
  const [changeSuccess, setChangeSuccess] = useState(false);

  const { data: walletsData, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => getWallets().then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addWallet({
        label: label || 'default',
        network,
        address,
        ...(is2faEnabled ? { totp_code: totpCode } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setShowForm(false);
      setLabel('');
      setAddress('');
      setTotpCode('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWallet(id, deleteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setDeletingId(null);
      setDeleteCode('');
    },
  });

  const changeMutation = useMutation({
    mutationFn: () =>
      requestWalletChange({
        name: changeName,
        phone: changePhone,
        current_address: changeModal!.address,
        new_address: changeNewAddress,
        network: changeModal!.network,
      }),
    onSuccess: () => {
      setChangeSuccess(true);
    },
  });

  const openChangeModal = (wallet: UserWallet) => {
    setChangeModal(wallet);
    setChangeName('');
    setChangePhone('');
    setChangeNewAddress('');
    setChangeSuccess(false);
    changeMutation.reset();
  };

  const closeChangeModal = () => {
    setChangeModal(null);
    setChangeSuccess(false);
    changeMutation.reset();
  };

  const inputClass =
    'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';
  const inputSmClass =
    'w-48 rounded-xl bg-gray-100 px-4 py-2.5 text-center text-sm font-medium tracking-widest text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

  if (isLoading)
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );

  const wallets: UserWallet[] = walletsData || [];
  const addDisabled = !address.trim() || (is2faEnabled && !totpCode) || addMutation.isPending;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">USDT 지갑 관리</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            지갑 추가
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-5 space-y-4 rounded-2xl bg-white p-5 dark:bg-gray-800/50">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">라벨</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="내 지갑"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">네트워크</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'ERC20' | 'TRC20')}
              className={inputClass}
            >
              <option value="TRC20">TRC20 (TRON)</option>
              <option value="ERC20">ERC20 (Ethereum)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">지갑 주소</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="T..."
              className={`${inputClass} font-mono`}
            />
          </div>
          {is2faEnabled && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">
                2FA 코드
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6자리 코드 또는 백업 코드"
                className={inputSmClass}
              />
            </div>
          )}
          {addMutation.isError && (
            <p className="text-[13px] text-red-500">{extractApiError(addMutation.error)}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => addMutation.mutate()}
              disabled={addDisabled}
              className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {addMutation.isPending ? '등록 중...' : '등록'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setLabel('');
                setAddress('');
                setTotpCode('');
              }}
              className="rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {wallets.length === 0 && !showForm && (
        <p className="text-[13px] text-gray-400 dark:text-gray-500">등록된 지갑이 없습니다.</p>
      )}

      <div className="space-y-2.5">
        {wallets.map((wallet) => (
          <div key={wallet.id} className="flex items-center justify-between rounded-2xl bg-white p-4 dark:bg-gray-800/50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{wallet.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {wallet.network}
                </span>
                {wallet.is_default && (
                  <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-500 dark:bg-pink-500/10">
                    기본
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[12px] font-mono text-gray-400 dark:text-gray-500">
                {wallet.address}
              </p>
            </div>
            {deletingId === wallet.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="2FA"
                  className="w-20 rounded-lg bg-gray-100 px-2 py-1.5 text-center text-[12px] font-medium outline-none dark:bg-gray-700 dark:text-gray-300"
                />
                <button
                  onClick={() => deleteMutation.mutate(wallet.id)}
                  disabled={!deleteCode || deleteMutation.isPending}
                  className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  삭제
                </button>
                <button
                  onClick={() => {
                    setDeletingId(null);
                    setDeleteCode('');
                  }}
                  className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openChangeModal(wallet)}
                  className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-medium text-blue-500 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
                >
                  <Edit2 className="h-3 w-3" />
                  수정
                </button>
                <button
                  onClick={() => setDeletingId(wallet.id)}
                  className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 지갑 변경 신청 모달 */}
      {changeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => e.target === e.currentTarget && closeChangeModal()}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900">
            <h3 className="mb-1 text-[16px] font-bold text-gray-900 dark:text-white">
              휴대폰으로 변경 신청 안내
            </h3>
            <p className="mb-5 text-[13px] text-gray-500 dark:text-gray-400">
              지갑 주소 변경은 본인 확인 후 처리됩니다. 아래 정보를 입력하고 신청해주세요.
            </p>

            {changeSuccess ? (
              <div className="rounded-2xl bg-green-50 p-4 text-center dark:bg-green-500/10">
                <p className="text-[14px] font-bold text-green-600 dark:text-green-400">
                  신청이 완료되었습니다.
                </p>
                <p className="mt-1 text-[12px] text-green-500">
                  검토 후 등록된 휴대폰으로 안내드리겠습니다.
                </p>
                <button
                  onClick={closeChangeModal}
                  className="mt-4 rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white dark:bg-white dark:text-gray-900"
                >
                  확인
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">이름</label>
                  <input
                    type="text"
                    value={changeName}
                    onChange={(e) => setChangeName(e.target.value)}
                    placeholder="홍길동"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    휴대폰번호
                  </label>
                  <input
                    type="tel"
                    value={changePhone}
                    onChange={(e) => setChangePhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    현재 지갑 주소
                  </label>
                  <input
                    type="text"
                    value={changeModal.address}
                    readOnly
                    className={`${inputClass} cursor-not-allowed font-mono opacity-60`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    변경할 지갑 주소
                  </label>
                  <input
                    type="text"
                    value={changeNewAddress}
                    onChange={(e) => setChangeNewAddress(e.target.value)}
                    placeholder="새 지갑 주소 입력"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                {changeMutation.isError && (
                  <p className="text-[13px] text-red-500">{extractApiError(changeMutation.error)}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => changeMutation.mutate()}
                    disabled={
                      !changeName.trim() ||
                      !changePhone.trim() ||
                      !changeNewAddress.trim() ||
                      changeMutation.isPending
                    }
                    className="flex-1 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    {changeMutation.isPending ? '신청 중...' : '신청하기'}
                  </button>
                  <button
                    onClick={closeChangeModal}
                    className="rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
