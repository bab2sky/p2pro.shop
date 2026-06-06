import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  CheckCircle,
  AlertCircle,
  X,
  HelpCircle,
} from 'lucide-react';
import { getSellerQna, answerQna, type SellerQna } from '@/lib/api/seller';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none resize-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function SellerQnaPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const [filter, setFilter] = useState<boolean | undefined>(undefined);
  const [answerModal, setAnswerModal] = useState<SellerQna | null>(null);
  const [answerText, setAnswerText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sellerQna', page, filter],
    queryFn: () => getSellerQna({ page, per_page: 20, answered: filter }),
  });

  const submitAnswer = useMutation({
    mutationFn: ({ qnaId, answer }: { qnaId: string; answer: string }) => answerQna(qnaId, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerQna'] });
      queryClient.invalidateQueries({ queryKey: ['sellerDashboardStats'] });
      setAnswerModal(null);
      setAnswerText('');
    },
  });

  if (isLoading)
    return (
      <div className="max-w-6xl space-y-3 py-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
        ))}
      </div>
    );

  const items = data?.data ?? [];

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Q&A 관리</h1>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => { setFilter(undefined); searchParams.delete('page'); setSearchParams(searchParams); }}
          className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            filter === undefined ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => { setFilter(false); searchParams.delete('page'); setSearchParams(searchParams); }}
          className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            filter === false ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          미답변
        </button>
        <button
          onClick={() => { setFilter(true); searchParams.delete('page'); setSearchParams(searchParams); }}
          className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            filter === true ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          답변완료
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <HelpCircle className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Q&A가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((qna: SellerQna) => (
            <div key={qna.id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        qna.answer ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-red-50 text-red-500 dark:bg-red-500/10'
                      }`}>
                        {qna.answer ? '답변완료' : '미답변'}
                      </span>
                      {qna.is_secret && (
                        <span className="flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          <Lock className="h-3 w-3" />
                          비밀글
                        </span>
                      )}
                      <Link to={`/products/${qna.product_id}`} className="text-sm font-bold text-gray-900 hover:text-pink-500 dark:text-white dark:hover:text-pink-400">
                        {qna.product_title}
                      </Link>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="mr-1.5 font-bold text-gray-900 dark:text-white">Q.</span>
                        {qna.question}
                      </p>
                      <p className="mt-1.5 text-[12px] text-gray-400">
                        {qna.user_nickname} | {new Date(qna.created_at).toLocaleDateString('ko')}
                      </p>
                    </div>
                    {qna.answer && (
                      <div className="mt-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="mr-1.5 font-bold text-pink-500">A.</span>
                          {qna.answer}
                        </p>
                        <p className="mt-1.5 text-[12px] text-gray-400">
                          {qna.answered_at && new Date(qna.answered_at).toLocaleDateString('ko')}
                        </p>
                      </div>
                    )}
                  </div>
                  {!qna.answer && (
                    <button
                      onClick={() => { setAnswerModal(qna); setAnswerText(''); }}
                      className="ml-4 shrink-0 rounded-full bg-gray-900 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      답변하기
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.total_pages > 1 && (
        <div className="mt-8 flex justify-center gap-1.5">
          {Array.from({ length: data.pagination.total_pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => { searchParams.set('page', String(p)); setSearchParams(searchParams); }}
              className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                p === page ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Answer modal */}
      {answerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setAnswerModal(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Q&A 답변</h3>
              <button onClick={() => setAnswerModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">{answerModal.product_title}</p>
              <p className="mt-1.5 text-sm font-bold text-gray-900 dark:text-white">Q. {answerModal.question}</p>
              <p className="mt-1 text-[12px] text-gray-400">{answerModal.user_nickname}</p>
            </div>
            <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="답변을 입력하세요..." rows={4} className={inputClass} />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAnswerModal(null)} className="rounded-full bg-gray-100 px-5 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">취소</button>
              <button
                onClick={() => submitAnswer.mutate({ qnaId: answerModal.id, answer: answerText })}
                disabled={!answerText.trim() || submitAnswer.isPending}
                className="rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                {submitAnswer.isPending ? '등록중...' : '답변 등록'}
              </button>
            </div>
            {submitAnswer.isError && <p className="mt-2 text-center text-[13px] text-red-500">답변 등록에 실패했습니다.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
