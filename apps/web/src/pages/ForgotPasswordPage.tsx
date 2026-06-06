import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import { authApi } from '@/features/auth/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: (e: string) => authApi.forgotPassword(e),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
        <div className="flex items-center px-4 py-3">
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            로그인
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
              <Mail className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">이메일을 확인하세요</h2>
            <p className="mb-6 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
              등록된 이메일이라면 비밀번호 재설정 링크가 발송되었습니다.
              메일함을 확인해주세요.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-900 transition-colors hover:text-gray-600 dark:text-white dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      <div className="flex items-center px-4 py-3">
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          로그인
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 dark:bg-white">
              <Mail className="h-7 w-7 text-white dark:text-gray-900" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">비밀번호 찾기</h1>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
              가입 시 사용한 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) mutation.mutate(email.trim());
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                이메일 주소
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {mutation.isError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                오류가 발생했습니다. 잠시 후 다시 시도해주세요.
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending || !email.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Mail className="h-4 w-4" />
              {mutation.isPending ? '전송 중...' : '재설정 링크 전송'}
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              로그인으로 돌아가기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
