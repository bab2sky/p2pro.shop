import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { deactivateAccount } from '@/lib/api/profile';
import { useAuthStore } from '@/stores/auth';
import { extractApiError } from '@/lib/api-error';

export function AccountDeactivate() {
  const [confirmed, setConfirmed] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [reason, setReason] = useState('');
  const { logout } = useAuthStore();

  const mutation = useMutation({
    mutationFn: () => deactivateAccount({ totp_code: totpCode || undefined, reason }),
    onSuccess: () => {
      logout();
    },
  });

  return (
    <div>
      <h2 className="mb-5 text-[15px] font-bold text-red-500">계정 탈퇴</h2>
      <div className="mb-5 rounded-2xl bg-red-50 p-4 dark:bg-red-500/10">
        <p className="mb-2 text-sm font-bold text-red-600 dark:text-red-400">주의사항</p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-red-600/80 dark:text-red-400/80">
          <li>탈퇴 요청 후 30일의 유예 기간이 있습니다.</li>
          <li>유예 기간 내에 로그인하면 탈퇴가 취소됩니다.</li>
          <li>30일 후 모든 데이터가 영구 삭제됩니다.</li>
          <li>진행 중인 주문이 있으면 탈퇴할 수 없습니다.</li>
        </ul>
      </div>

      {!confirmed ? (
        <button
          onClick={() => setConfirmed(true)}
          className="rounded-full bg-red-500 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-red-600"
        >
          계정 탈퇴 진행
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">탈퇴 사유 (선택)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-red-500/20 dark:bg-gray-800 dark:text-gray-100"
              placeholder="탈퇴 사유를 입력하세요..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">2FA 코드 (설정한 경우)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6자리 코드"
              className="w-48 rounded-xl bg-gray-100 px-4 py-2.5 text-center text-sm font-medium tracking-widest text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-red-500/20 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {mutation.isError && (
            <p className="text-[13px] text-red-500">{extractApiError(mutation.error)}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="rounded-full bg-red-500 px-6 py-2 text-[13px] font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {mutation.isPending ? '처리 중...' : '탈퇴 요청'}
            </button>
            <button
              onClick={() => { setConfirmed(false); setTotpCode(''); setReason(''); }}
              className="rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
