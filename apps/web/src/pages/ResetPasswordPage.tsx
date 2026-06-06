import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { authApi } from '@/features/auth/api';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword(token, password),
    onSuccess: () => setSuccess(true),
  });

  const passwordStrength = password.length < 8 ? 'weak' : password.length < 12 ? 'medium' : 'strong';
  const strengthColor = { weak: 'bg-red-400', medium: 'bg-amber-400', strong: 'bg-emerald-400' }[passwordStrength];
  const strengthWidth = { weak: 'w-1/3', medium: 'w-2/3', strong: 'w-full' }[passwordStrength];

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
        <div className="flex items-center px-4 py-3">
          <Link
            to="/forgot-password"
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('auth.resetPassword.backToForgot', '비밀번호 찾기')}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>
            <h1 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">{t('auth.resetPassword.invalidLink', '잘못된 링크')}</h1>
            <p className="mb-6 text-[13px] text-gray-500 dark:text-gray-400">{t('auth.resetPassword.invalidLinkDesc', '유효하지 않은 비밀번호 재설정 링크입니다.')}</p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-900 transition-colors hover:text-gray-600 dark:text-white dark:hover:text-gray-300"
            >
              {t('auth.resetPassword.requestAgain', '비밀번호 재설정 다시 요청하기')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
        <div className="flex items-center px-4 py-3">
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('auth.resetPassword.backToLogin', '로그인')}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">{t('auth.resetPassword.changedTitle', '비밀번호가 변경되었습니다')}</h2>
            <p className="mb-6 text-[13px] text-gray-500 dark:text-gray-400">{t('auth.resetPassword.changedDesc', '새 비밀번호로 로그인하세요.')}</p>
            <button
              onClick={() => navigate('/login')}
              className="rounded-full bg-gray-900 px-8 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {t('auth.resetPassword.goLogin', '로그인하기')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isValid = password.length >= 8 && password === confirm;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      <div className="flex items-center px-4 py-3">
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('auth.resetPassword.backToLogin', '로그인')}
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 dark:bg-white">
              <Lock className="h-7 w-7 text-white dark:text-gray-900" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('auth.resetPassword.title', '비밀번호 재설정')}</h1>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">{t('auth.resetPassword.subtitle', '새로운 비밀번호를 입력하세요.')}</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isValid) mutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.resetPassword.newPassword', '새 비밀번호')}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.resetPassword.newPasswordPlaceholder', '8자 이상 입력')}
                className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100"
              />
              {password.length > 0 && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className={`h-full rounded-full transition-all ${strengthColor} ${strengthWidth}`} />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.resetPassword.confirmPassword', '비밀번호 확인')}
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('auth.resetPassword.confirmPlaceholder', '비밀번호를 다시 입력')}
                className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100"
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="mt-1 text-[11px] font-medium text-red-500">{t('auth.resetPassword.passwordMismatch', '비밀번호가 일치하지 않습니다.')}</p>
              )}
            </div>

            {mutation.isError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {t('auth.resetPassword.expired', '링크가 만료되었거나 유효하지 않습니다. 다시 요청해주세요.')}
              </div>
            )}

            <button
              type="submit"
              disabled={!isValid || mutation.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Lock className="h-4 w-4" />
              {mutation.isPending ? t('auth.resetPassword.loadingButton', '처리 중...') : t('auth.resetPassword.resetSubmit', '비밀번호 재설정')}
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('auth.resetPassword.backToLoginLong', '로그인으로 돌아가기')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
