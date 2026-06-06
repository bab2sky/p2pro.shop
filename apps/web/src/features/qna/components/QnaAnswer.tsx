import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAnswer } from '@/lib/api/qna';
import { Pencil } from 'lucide-react';

interface Props {
  qnaId: string;
  productId: string;
}

export function QnaAnswer({ qnaId, productId }: Props) {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => createAnswer(qnaId, answer),
    onSuccess: () => {
      setAnswer('');
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['productQna', productId] });
    },
  });

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
      >
        <Pencil className="h-3 w-3" />
        답변 작성
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/30 dark:bg-emerald-900/10">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="답변을 작성하세요..."
        rows={3}
        className="w-full resize-none rounded-xl border border-emerald-200 bg-white p-3 text-[14px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-400 dark:border-emerald-900/30 dark:bg-gray-950 dark:text-white"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { setIsOpen(false); setAnswer(''); }}
          className="rounded-lg px-4 py-2 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          취소
        </button>
        <button
          onClick={() => answer.trim() && mutation.mutate()}
          disabled={!answer.trim() || mutation.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
        >
          {mutation.isPending ? '등록 중...' : '답변 등록'}
        </button>
      </div>
    </div>
  );
}
