import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, setupTotp, verifyTotp, disableTotp } from '@/lib/api/profile';
import { extractApiError } from '@/lib/api-error';

type Step = 'idle' | 'qr' | 'verify' | 'backup' | 'disable';

export function TotpSetup() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfile().then((r) => r.data),
  });

  const setupMutation = useMutation({
    mutationFn: setupTotp,
    onSuccess: (res) => {
      setSecret(res.data.secret);
      setQrUrl(res.data.qr_url);
      setBackupCodes(res.data.backup_codes);
      setStep('qr');
      setError('');
    },
    onError: (err: unknown) => {
      setError(extractApiError(err));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyTotp(code),
    onSuccess: () => {
      setStep('backup');
      setCode('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: unknown) => {
      setError(extractApiError(err));
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => disableTotp(disableCode),
    onSuccess: () => {
      setStep('idle');
      setDisableCode('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: unknown) => {
      setError(extractApiError(err));
    },
  });

  const isEnabled = profile?.totp_enabled;

  const inputClass = 'w-48 rounded-xl bg-gray-100 px-4 py-2.5 text-center text-sm font-medium tracking-widest text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';
  const btnPrimary = 'rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100';
  const btnSecondary = 'rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700';
  const btnDanger = 'rounded-full bg-red-500 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50';

  return (
    <div>
      <h2 className="mb-5 text-[15px] font-bold text-gray-900 dark:text-white">2단계 인증 (2FA)</h2>

      {isEnabled && step === 'idle' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">2FA 활성화됨</span>
          </div>
          <button onClick={() => setStep('disable')} className={btnDanger}>
            비활성화
          </button>
        </div>
      )}

      {isEnabled && step === 'disable' && (
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">2FA를 비활성화하려면 현재 인증 코드를 입력하세요.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6자리 코드"
            className={inputClass}
          />
          {error && <p className="text-[13px] text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => disableMutation.mutate()} disabled={disableCode.length !== 6 || disableMutation.isPending} className={btnDanger}>
              {disableMutation.isPending ? '처리 중...' : '비활성화'}
            </button>
            <button onClick={() => { setStep('idle'); setError(''); setDisableCode(''); }} className={btnSecondary}>
              취소
            </button>
          </div>
        </div>
      )}

      {!isEnabled && step === 'idle' && (
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            2단계 인증을 활성화하면 출금, 지갑 변경 시 추가 인증이 필요합니다.
          </p>
          {error && <p className="text-[13px] text-red-500">{error}</p>}
          <button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending} className={btnPrimary}>
            {setupMutation.isPending ? '설정 중...' : '2FA 활성화'}
          </button>
        </div>
      )}

      {step === 'qr' && (
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            Google Authenticator 또는 호환 앱으로 아래 QR코드를 스캔하세요.
          </p>
          <div className="flex justify-center rounded-2xl bg-white p-6 dark:bg-gray-800">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
              alt="TOTP QR Code"
              className="h-48 w-48"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[12px] text-gray-400 dark:text-gray-500">QR코드를 스캔할 수 없으면 아래 코드를 직접 입력하세요:</p>
            <code className="block rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-mono break-all dark:bg-gray-800 dark:text-gray-300">
              {secret}
            </code>
          </div>
          <button onClick={() => setStep('verify')} className={btnPrimary}>
            다음
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            앱에 표시된 6자리 인증 코드를 입력하세요.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6자리 코드"
            className={inputClass}
          />
          {error && <p className="text-[13px] text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => verifyMutation.mutate()} disabled={code.length !== 6 || verifyMutation.isPending} className={btnPrimary}>
              {verifyMutation.isPending ? '확인 중...' : '확인'}
            </button>
            <button onClick={() => { setStep('idle'); setError(''); setCode(''); }} className={btnSecondary}>
              취소
            </button>
          </div>
        </div>
      )}

      {step === 'backup' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
            <p className="mb-1 text-sm font-bold text-amber-700 dark:text-amber-400">
              백업 코드를 안전한 곳에 저장하세요
            </p>
            <p className="text-[12px] text-amber-600 dark:text-amber-400/80">
              이 코드는 한 번만 표시됩니다. 인증 앱에 접근할 수 없을 때 이 코드로 로그인할 수 있습니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((bc, i) => (
              <code
                key={i}
                className="rounded-xl bg-gray-100 px-3 py-2.5 text-center text-sm font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {bc}
              </code>
            ))}
          </div>
          <button
            onClick={() => { setStep('idle'); setBackupCodes([]); setSecret(''); setQrUrl(''); }}
            className={btnPrimary}
          >
            완료
          </button>
        </div>
      )}
    </div>
  );
}
