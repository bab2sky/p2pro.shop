import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createQuestion } from '@/lib/api/qna';
import { useAuthStore } from '@/stores/auth';
import { Lock, Send } from 'lucide-react';

interface Props {
  productId: string;
}

export function QnaForm({ productId }: Props) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [isSecret, setIsSecret] = useState(false);

  const mutation = useMutation({
    mutationFn: () => createQuestion(productId, { question, is_secret: isSecret }),
    onSuccess: () => {
      setQuestion('');
      setIsSecret(false);
      queryClient.invalidateQueries({ queryKey: ['productQna', productId] });
    },
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 py-8 dark:border-gray-700">
        <p className="text-[14px] text-gray-400">질문을 작성하려면 로그인이 필요합니다</p>
        <Link
          to="/login"
          className="rounded-xl bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="궁금한 점을 질문해주세요..."
        rows={3}
        maxLength={500}
        className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-[14px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-gray-600 dark:focus:bg-gray-950"
      />
      <div className="mt-3 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
          <input
            type="checkbox"
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-gray-600"
          />
          <Lock className="h-3.5 w-3.5" />
          비밀 질문
        </label>
        <button
          onClick={() => question.trim() && mutation.mutate()}
          disabled={!question.trim() || mutation.isPending}
          className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          <Send className="h-3.5 w-3.5" />
          {mutation.isPending ? '등록 중...' : '질문 등록'}
        </button>
      </div>
    </div>
  );
}
