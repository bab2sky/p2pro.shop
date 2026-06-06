import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductQna } from '@/lib/api/qna';
import { useAuthStore } from '@/stores/auth';
import { QnaForm } from './QnaForm';
import { QnaAnswer } from './QnaAnswer';
import { Lock, MessageCircleQuestion, CheckCircle2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  productId: string;
  sellerId?: string;
}

export function QnaSection({ productId, sellerId }: Props) {
  const [page, setPage] = useState(1);
  const user = useAuthStore((s) => s.user);
  const isSeller = user && sellerId && user.id === sellerId;

  const { data, isLoading } = useQuery({
    queryKey: ['productQna', productId, page],
    queryFn: () => getProductQna(productId, { page, per_page: 10 }),
  });

  const items = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Form */}
      <QnaForm productId={productId} />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-white" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <MessageCircleQuestion className="mb-3 h-10 w-10 stroke-[1.2]" />
          <p className="text-[15px] font-bold">등록된 Q&A가 없습니다</p>
          <p className="mt-1 text-[13px]">궁금한 점을 질문해보세요!</p>
        </div>
      )}

      {/* List */}
      {items.length > 0 && (
        <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((item) => {
            const isOwner = user && item.user_nickname === user.nickname;
            const canView = !item.is_secret || isOwner || isSeller || user?.role === 'admin';

            return (
              <div key={item.id} className="py-5 first:pt-0">
                {canView ? (
                  <>
                    {/* Question */}
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-[11px] font-black text-white dark:bg-white dark:text-gray-900">
                        Q
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {item.is_secret && (
                            <span className="flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                              <Lock className="h-2.5 w-2.5" />
                              비밀
                            </span>
                          )}
                          {item.answer ? (
                            <span className="flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              답변완료
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              <Clock className="h-2.5 w-2.5" />
                              답변대기
                            </span>
                          )}
                        </div>
                        <p className="text-[14px] leading-relaxed text-gray-900 dark:text-white">
                          {item.question}
                        </p>
                        <p className="mt-1.5 text-[12px] text-gray-400">
                          {item.user_nickname} · {new Date(item.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Answer */}
                    {item.answer ? (
                      <div className="ml-9 mt-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-black text-white">
                            A
                          </span>
                          <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">판매자</span>
                        </div>
                        <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-300">
                          {item.answer}
                        </p>
                        <p className="mt-2 text-[12px] text-gray-400">
                          {item.answered_at
                            ? new Date(item.answered_at).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : ''}
                        </p>
                      </div>
                    ) : isSeller ? (
                      <div className="ml-9">
                        <QnaAnswer qnaId={item.id} productId={productId} />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex items-center gap-3 text-gray-400">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-[11px] font-black text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      Q
                    </span>
                    <div className="flex items-center gap-1.5 text-[14px]">
                      <Lock className="h-3.5 w-3.5" />
                      비밀 질문입니다.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | 'dots')[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('dots');
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === 'dots' ? (
                <span key={`dots-${idx}`} className="px-1 text-[13px] text-gray-400">...</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setPage(item as number)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold transition-colors ${
                    page === item
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
