import { type FormEvent, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, ArrowLeft, Check, Loader2, X, FileText, Shield, Mail } from 'lucide-react';
import { authApi } from './api';
import { useAuthStore } from './store';
import { extractApiError } from '@/lib/api-error';
import { sanitizeHtml } from '@/lib/sanitize';
import { getTermsOfService, getPrivacyPolicy } from '@/lib/api/legal';
import { PhoneInput } from '@/components/phone/PhoneInput';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

function LegalModal({ type, onClose }: { type: 'terms' | 'privacy'; onClose: () => void }) {
  const { t } = useTranslation();
  const isTerms = type === 'terms';
  const { data: content, isLoading } = useQuery({
    queryKey: ['legal', type],
    queryFn: isTerms ? getTermsOfService : getPrivacyPolicy,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            {isTerms ? <FileText className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            {isTerms ? t('common.termsOfService', '이용약관') : t('common.privacyPolicy', '개인정보처리방침')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : content ? (
            <div
              className="prose prose-sm max-w-none text-gray-700 dark:prose-invert dark:text-gray-300 prose-headings:font-bold"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              {isTerms ? t('auth.signup.legalNotRegistered.terms', '이용약관이 등록되지 않았습니다.') : t('auth.signup.legalNotRegistered.privacy', '개인정보처리방침이 등록되지 않았습니다.')}
            </p>
          )}
        </div>
        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {t('common.confirm', '확인')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [referrerCode, setReferrerCode] = useState('');
  const [referrerStatus, setReferrerStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referrerNickname, setReferrerNickname] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Email duplicate check state
  const [emailCheckStatus, setEmailCheckStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate'>('idle');

  // Email verification state
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Phone state
  const [phone, setPhone] = useState('');
  const [phoneCheckStatus, setPhoneCheckStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate'>('idle');
  const [isUdgMember, setIsUdgMember] = useState(true);

  // URL referral code auto-fill
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferrerCode(refCode);
      // The existing debounced validation will trigger automatically
    }
  }, [searchParams]);

  // Reset email check status and verification when email changes
  useEffect(() => {
    setEmailCheckStatus('idle');
    setEmailVerified(false);
    setCodeSent(false);
    setVerificationCode('');
    setVerifyError('');
    setError('');
  }, [email]);

  // Reset phone check status when phone changes
  useEffect(() => {
    setPhoneCheckStatus('idle');
  }, [phone]);

  // Countdown timer for verification code expiry (5 min)
  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = setInterval(() => {
      setCodeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [codeCountdown]);

  // Cooldown timer for resend button (60 sec)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Email duplicate check handler
  const handleEmailCheck = async () => {
    if (!email.trim()) return;
    setEmailCheckStatus('checking');
    setError('');
    try {
      const { data: res } = await authApi.checkEmailDuplicate(email);
      setEmailCheckStatus(res.data.available ? 'available' : 'duplicate');
    } catch (err: unknown) {
      // 429/네트워크 등 모든 에러를 'duplicate'로 표시하면 거짓 양성이 됨.
      // status는 idle로 복귀시키고 실제 에러는 폼 상단 알림으로 노출한다.
      setEmailCheckStatus('idle');
      setError(extractApiError(err) || t('auth.signup.checkRateLimited', '잠시 후 다시 시도해주세요.'));
    }
  };

  // Phone duplicate check handler
  const handlePhoneCheck = async () => {
    if (!phone || phone.length < 8) return;
    setPhoneCheckStatus('checking');
    try {
      const { data: res } = await authApi.checkPhoneDuplicate(phone);
      setPhoneCheckStatus(res.data.available ? 'available' : 'duplicate');
    } catch {
      setPhoneCheckStatus('idle');
    }
  };

  // Send verification code handler
  const handleSendVerification = async () => {
    if (!email.trim() || emailCheckStatus !== 'available') return;
    setVerifyError('');
    setVerifyLoading(true);
    try {
      await authApi.sendVerificationCode(email);
      setCodeSent(true);
      setCodeCountdown(300); // 5 minutes
      setResendCooldown(60); // 60 seconds between sends
      setVerificationCode('');
    } catch (err: unknown) {
      setVerifyError(extractApiError(err));
    } finally {
      setVerifyLoading(false);
    }
  };

  // Verify email code handler
  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) return;
    setVerifyError('');
    setVerifyLoading(true);
    try {
      const { data: res } = await authApi.verifyEmailCode(email, verificationCode);
      if (res.data.verified) {
        setEmailVerified(true);
        setCodeSent(false);
        setCodeCountdown(0);
      }
    } catch (err: unknown) {
      setVerifyError(extractApiError(err));
    } finally {
      setVerifyLoading(false);
    }
  };

  // Debounced referrer code check
  const checkReferrer = useCallback(async (code: string) => {
    if (!code.trim()) {
      setReferrerStatus('idle');
      setReferrerNickname('');
      return;
    }
    setReferrerStatus('checking');
    try {
      const { data: res } = await authApi.checkReferrer(code);
      if (res.data.valid) {
        setReferrerStatus('valid');
        setReferrerNickname(res.data.nickname ?? '');
      } else {
        setReferrerStatus('invalid');
        setReferrerNickname('');
      }
    } catch (err: unknown) {
      // 429/네트워크 등 모든 에러를 'invalid'로 표시하면 거짓 양성이 됨.
      // status는 idle로 복귀시키고 실제 에러는 폼 상단 알림으로 노출한다.
      setReferrerStatus('idle');
      setReferrerNickname('');
      setError(extractApiError(err) || t('auth.signup.checkRateLimited', '잠시 후 다시 시도해주세요.'));
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => checkReferrer(referrerCode), 500);
    return () => clearTimeout(timer);
  }, [referrerCode, checkReferrer]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError(t('auth.signup.error.passwordMismatch'));
      return;
    }

    if (!emailVerified) {
      setError(t('auth.signup.emailRequired', '이메일 인증이 필요합니다.'));
      return;
    }

    if (!phone || phoneCheckStatus !== 'available') {
      setError(t('auth.signup.phoneRequired', '휴대폰 번호 중복확인이 필요합니다.'));
      return;
    }

    if (!termsAgreed || !privacyAgreed) {
      setError(t('auth.termsRequired'));
      return;
    }

    if (referrerCode && referrerStatus === 'invalid') {
      setError(t('auth.signup.referrerInvalid', '유효하지 않은 추천인 코드입니다.'));
      return;
    }

    setLoading(true);

    try {
      const { data: res } = await authApi.signup({
        email,
        password,
        nickname: nickname || undefined,
        phone,
        is_udg_member: isUdgMember,
        referrer_code: referrerCode || undefined,
        terms_agreed: termsAgreed,
        privacy_agreed: privacyAgreed,
      });
      const { access_token, refresh_token, user } = res.data;
      setAuth(access_token, refresh_token, user);
      navigate('/');
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  // Real-time password strength validation
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const passwordPassedCount = [passwordChecks.uppercase, passwordChecks.lowercase, passwordChecks.digit, passwordChecks.special].filter(Boolean).length;
  const passwordValid = passwordChecks.length && passwordPassedCount >= 3;

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
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm">
          {/* Logo / Icon */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 dark:bg-white">
              <UserPlus className="h-7 w-7 text-white dark:text-gray-900" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('auth.registerTitle')}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              {t('auth.registerSubtitle', 'P2PRO에 오신 것을 환영합니다')}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" aria-label={t('auth.formAriaRegister', '회원가입 양식')}>
            {/* Email */}
            <div>
              <label htmlFor="register-email" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.email')} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@example.com"
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={handleEmailCheck}
                  disabled={emailCheckStatus === 'checking' || !email.trim()}
                  className="shrink-0 rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {emailCheckStatus === 'checking' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('auth.signup.checkDuplicate', '중복확인')
                  )}
                </button>
              </div>
              {emailCheckStatus === 'available' && !emailVerified && (
                <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('auth.signup.emailAvailable', '사용 가능한 이메일입니다')}</p>
              )}
              {emailCheckStatus === 'duplicate' && (
                <p className="mt-1.5 text-xs font-medium text-red-500">{t('auth.signup.emailDuplicate', '이미 사용 중인 이메일입니다')}</p>
              )}
              {emailVerified && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('auth.signup.emailVerified', '이메일 인증 완료')}</p>
                </div>
              )}

              {/* Email Verification Section */}
              {emailCheckStatus === 'available' && !emailVerified && (
                <div className="mt-3 space-y-2.5">
                  {/* Send / Resend button */}
                  <button
                    type="button"
                    onClick={handleSendVerification}
                    disabled={verifyLoading || resendCooldown > 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {verifyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {codeSent
                      ? resendCooldown > 0
                        ? t('auth.signup.resendCountdown', { seconds: resendCooldown, defaultValue: '재발송 ({{seconds}}초)' })
                        : t('auth.signup.resend', '재발송')
                      : t('auth.signup.sendCode', '인증코드 발송')}
                  </button>

                  {/* Code input + verify */}
                  {codeSent && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setVerificationCode(val);
                          }}
                          placeholder={t('auth.signup.codePlaceholder', '인증코드 6자리')}
                          maxLength={6}
                          className="flex-1 rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-center text-sm font-bold tracking-widest text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyCode}
                          disabled={verifyLoading || verificationCode.length !== 6}
                          className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                        >
                          {verifyLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            t('auth.signup.codeConfirm', '확인')
                          )}
                        </button>
                      </div>
                      {codeCountdown > 0 && (
                        <p className="text-center text-xs text-gray-400">
                          {t('auth.signup.codeValidTime', { minutes: Math.floor(codeCountdown / 60), seconds: String(codeCountdown % 60).padStart(2, '0'), defaultValue: '인증코드 유효시간: {{minutes}}:{{seconds}}' })}
                        </p>
                      )}
                      {codeCountdown === 0 && codeSent && (
                        <p className="text-center text-xs text-red-500">{t('auth.signup.codeExpired', '인증코드가 만료되었습니다. 재발송해주세요.')}</p>
                      )}
                    </div>
                  )}

                  {verifyError && (
                    <p className="text-xs font-medium text-red-500">{verifyError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="register-password" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t('auth.signup.passwordPlaceholder', '8자 이상 입력')}
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showPassword ? t('auth.passwordToggleHide', '비밀번호 숨기기') : t('auth.passwordToggleShow', '비밀번호 보기')}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {passwordChecks.length ? <Check className="h-3 w-3 text-emerald-500" /> : <X className="h-3 w-3 text-gray-300 dark:text-gray-600" />}
                    <span className={`text-xs ${passwordChecks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{t('auth.signup.passwordLengthCheck', '8자 이상')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordPassedCount >= 3 ? <Check className="h-3 w-3 text-emerald-500" /> : <X className="h-3 w-3 text-gray-300 dark:text-gray-600" />}
                    <span className={`text-xs ${passwordPassedCount >= 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                      {t('auth.signup.passwordComplexCheck', { count: passwordPassedCount, defaultValue: '대문자, 소문자, 숫자, 특수문자 중 3가지 이상 ({{count}}/4)' })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Password confirm */}
            <div>
              <label htmlFor="register-password-confirm" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.signup.passwordConfirm')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-password-confirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t('auth.signup.passwordConfirmPlaceholder', '비밀번호 재입력')}
                  className={`w-full rounded-xl border bg-gray-100 px-4 py-2.5 pr-10 text-sm font-medium outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800/50 dark:focus:bg-gray-900 ${
                    passwordMismatch
                      ? 'border-red-400 text-red-600 dark:border-red-500/50 dark:text-red-400'
                      : 'border-gray-200 text-gray-900 focus:border-gray-300 dark:border-gray-700 dark:text-gray-100 dark:focus:border-gray-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showPasswordConfirm ? t('auth.signup.passwordConfirmHide', '비밀번호 확인 숨기기') : t('auth.signup.passwordConfirmShow', '비밀번호 확인 보기')}
                >
                  {showPasswordConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="mt-1.5 text-xs font-medium text-red-500">{t('auth.signup.error.passwordMismatch')}</p>
              )}
            </div>

            {/* Nickname */}
            <div>
              <label htmlFor="register-nickname" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.nickname')}
              </label>
              <input
                id="register-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t('auth.signup.nicknamePlaceholder', '닉네임 (선택)')}
                className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900"
              />
            </div>

            {/* 휴대폰 번호 */}
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.signup.phoneLabel', '휴대폰 번호')} <span className="text-red-500">*</span>
              </label>
              <div className="flex min-w-0 gap-2">
                <PhoneInput
                  value={phone}
                  onChange={(e164) => setPhone(e164)}
                  disabled={phoneCheckStatus === 'available'}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={handlePhoneCheck}
                  disabled={phoneCheckStatus === 'checking' || !phone || phone.length < 8 || phoneCheckStatus === 'available'}
                  className="shrink-0 rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {phoneCheckStatus === 'checking' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('auth.signup.checkDuplicate', '중복확인')
                  )}
                </button>
              </div>
              {phoneCheckStatus === 'available' && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('auth.signup.phoneAvailable', '사용 가능한 번호입니다')}</p>
                </div>
              )}
              {phoneCheckStatus === 'duplicate' && (
                <p className="mt-1.5 text-xs font-medium text-red-500">{t('auth.signup.phoneDuplicate', '이미 등록된 번호입니다')}</p>
              )}
              {phoneCheckStatus === 'available' && (
                <button
                  type="button"
                  onClick={() => { setPhone(''); setPhoneCheckStatus('idle'); }}
                  className="mt-1 text-xs text-gray-400 underline hover:text-gray-600"
                >
                  {t('auth.signup.phoneChange', '번호 변경')}
                </button>
              )}
            </div>

            {/* Referrer code */}
            <div>
              <label htmlFor="register-referrer" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {t('auth.referrerCode')}
              </label>
              <div className="relative">
                <input
                  id="register-referrer"
                  type="text"
                  value={referrerCode}
                  onChange={(e) => setReferrerCode(e.target.value)}
                  placeholder={t('auth.signup.referrerCodePlaceholder', '추천인 코드 8자리 입력')}
                  className={`w-full rounded-xl border bg-gray-100 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800/50 dark:focus:bg-gray-900 ${
                    referrerStatus === 'valid'
                      ? 'border-emerald-400 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-400'
                      : referrerStatus === 'invalid'
                        ? 'border-red-400 text-red-600 dark:border-red-500/50 dark:text-red-400'
                        : 'border-gray-200 text-gray-900 focus:border-gray-300 dark:border-gray-700 dark:text-gray-100 dark:focus:border-gray-600'
                  }`}
                />
                {referrerStatus === 'checking' && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
                {referrerStatus === 'valid' && (
                  <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
              {referrerStatus === 'valid' && (
                <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('auth.signup.referrerLabel', '추천인')}: {referrerNickname}</p>
              )}
              {referrerStatus === 'invalid' && (
                <p className="mt-1.5 text-xs font-medium text-red-500">{t('auth.signup.referrerInvalid', '유효하지 않은 추천인 코드입니다.')}</p>
              )}
            </div>

            {/* Terms */}
            <div className="space-y-3 rounded-2xl bg-gray-100 px-4 py-4 dark:bg-gray-900">
              <div className="flex items-center gap-3 text-sm">
                <input
                  id="terms-checkbox"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-gray-900 focus:ring-gray-900/20 dark:border-gray-600 dark:bg-gray-800"
                />
                <label htmlFor="terms-checkbox" className="cursor-pointer text-gray-700 dark:text-gray-300">
                  <button
                    type="button"
                    onClick={() => setLegalModal('terms')}
                    className="font-medium text-gray-900 underline-offset-2 hover:underline dark:text-white"
                  >
                    {t('auth.termsAgree')}
                  </button>{' '}
                  <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <input
                  id="privacy-checkbox"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-gray-900 focus:ring-gray-900/20 dark:border-gray-600 dark:bg-gray-800"
                />
                <label htmlFor="privacy-checkbox" className="cursor-pointer text-gray-700 dark:text-gray-300">
                  <button
                    type="button"
                    onClick={() => setLegalModal('privacy')}
                    className="font-medium text-gray-900 underline-offset-2 hover:underline dark:text-white"
                  >
                    {t('auth.privacyAgree')}
                  </button>{' '}
                  <span className="text-red-500">*</span>
                </label>
              </div>
            </div>

            {/* UDG 동시 가입 */}
            <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/30">
              <input
                id="udg-member"
                type="checkbox"
                checked={isUdgMember}
                onChange={(e) => setIsUdgMember(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-gray-900 dark:accent-gray-100"
              />
              <label htmlFor="udg-member" className="cursor-pointer text-xs text-gray-600 dark:text-gray-400">
                <span className="font-bold text-gray-900 dark:text-gray-100">{t('auth.signup.udgMemberTitle', 'UDG 동시 가입')}</span>
                <br />
                <span>{t('auth.signup.udgMemberDesc', 'UDG 보상 시스템에 가입하여 구매 시 보상 혜택을 받습니다. (기본 선택)')}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || passwordMismatch || !emailVerified || !passwordValid || phoneCheckStatus !== 'available'}
              className="w-full rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {loading ? t('common.loading') : t('auth.registerButton')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-bold text-gray-900 transition-colors hover:underline dark:text-white">
              {t('common.login')}
            </Link>
          </p>
        </div>
      </div>

      {/* Legal Modals */}
      {legalModal && (
        <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
      )}
    </div>
  );
}
