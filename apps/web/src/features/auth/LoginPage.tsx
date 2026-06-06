import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authApi } from './api';
import { useAuthStore } from './store';
import { extractApiError } from '@/lib/api-error';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [requires2fa, setRequires2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requires2fa) {
        const { data: res } = await authApi.login2fa({ email, password, totp_code: totpCode });
        const { access_token, refresh_token, user } = res.data;
        setAuth(access_token, refresh_token, user);
        navigate('/');
      } else {
        const { data: res } = await authApi.login({ email, password });
        const { access_token, refresh_token, user } = res.data;
        setAuth(access_token, refresh_token, user);
        navigate('/');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error_code?: string } } };
      if (axiosErr?.response?.data?.error_code === 'TWO_FA_REQUIRED') {
        setRequires2fa(true);
        setError('');
      } else {
        setError(extractApiError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.home', '홈')}
        </Link>
      </div>

      {/* Center content */}
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          {/* Logo / Icon */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 dark:bg-white">
              <Lock className="h-7 w-7 text-white dark:text-gray-900" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {requires2fa ? t('auth.twoFaTitle', '2단계 인증') : t('auth.loginTitle')}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              {requires2fa
                ? t('auth.twoFa.subtitle', '인증 앱의 6자리 코드를 입력해주세요')
                : t('auth.loginSubtitle', '계정에 로그인하세요')}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" aria-label={t('auth.formAriaLogin', '로그인 양식')}>
            {!requires2fa ? (
              <>
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    {t('auth.email')}
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="email@example.com"
                    className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    {t('auth.password')}
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 pr-11 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label={showPassword ? t('auth.passwordToggleHide', '비밀번호 숨기기') : t('auth.passwordToggleShow', '비밀번호 보기')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    {t('auth.forgotPassword', '비밀번호를 잊으셨나요?')}
                  </Link>
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="login-totp" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                  {t('auth.twoFa.codeLabel', '2FA 인증 코드')}
                </label>
                <input
                  id="login-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                  placeholder={t('auth.twoFa.placeholder', '6자리 코드 또는 백업 코드')}
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-center text-sm font-medium tracking-widest text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    setRequires2fa(false);
                    setTotpCode('');
                    setError('');
                  }}
                  className="mt-2 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  {t('auth.twoFa.back', '← 이메일/비밀번호로 돌아가기')}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (requires2fa && !totpCode)}
              className="w-full rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {loading
                ? t('common.loading')
                : requires2fa
                  ? t('auth.twoFa.submit', '인증 완료')
                  : t('auth.loginButton')}
            </button>
          </form>

          {!requires2fa && (
            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="font-bold text-gray-900 transition-colors hover:underline dark:text-white">
                {t('common.register')}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
