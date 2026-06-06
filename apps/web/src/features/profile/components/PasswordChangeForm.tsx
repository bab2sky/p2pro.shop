import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changePassword } from '@/lib/api/profile';
import { extractApiError } from '@/lib/api-error';

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setValidationError('');
    },
  });

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다';
    if (!/[A-Z]/.test(password)) return '대문자를 1개 이상 포함해야 합니다';
    if (!/[0-9]/.test(password)) return '숫자를 1개 이상 포함해야 합니다';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setValidationError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('새 비밀번호가 일치하지 않습니다');
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="rounded-2xl border border-gray-300 p-6 dark:border-gray-600">
      <h2 className="mb-4 text-lg font-semibold">비밀번호 변경</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-[12px] font-bold text-gray-500">현재 비밀번호</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-bold text-gray-500">새 비밀번호</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600"
            required
          />
          <p className="mt-1 text-xs text-gray-400">
            8자 이상, 대문자 1개, 숫자 1개 이상 포함
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-bold text-gray-500">새 비밀번호 확인</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600"
            required
          />
        </div>

        {validationError && <p className="text-sm text-red-600">{validationError}</p>}

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {extractApiError(mutation.error)}
          </p>
        )}

        {mutation.isSuccess && (
          <p className="text-sm text-green-600">비밀번호가 변경되었습니다</p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-full bg-gray-900 px-6 py-2 text-[13px] font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {mutation.isPending ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  );
}
