import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { sanitizeHtml } from '@/lib/sanitize';
import { ArrowLeft, Pin, AlertCircle } from 'lucide-react';
import { getNotice } from '@/lib/api/content';
import { SimplePageHeader } from '@/components/layout/SimplePageHeader';

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notice', id],
    queryFn: () => getNotice(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
        <SimplePageHeader />
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
          <div className="h-6 w-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-3/4 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
        <SimplePageHeader />
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800">
            <AlertCircle className="h-7 w-7 text-gray-300" />
          </div>
          <p className="text-[13px] font-bold text-gray-400">공지사항을 찾을 수 없습니다.</p>
          <Link
            to="/notices"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-900 transition-colors hover:text-gray-600 dark:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const notice = data.data;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <SimplePageHeader />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          to="/notices"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          공지사항 목록
        </Link>

        <article className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 p-5 dark:border-gray-800">
            <div className="mb-2 flex items-center gap-2">
              {notice.is_pinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-500/10">
                  <Pin className="h-3 w-3" />
                  고정
                </span>
              )}
              <span className="text-[12px] text-gray-400">
                {notice.created_at ? new Date(notice.created_at).toLocaleDateString() : ''}
              </span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{notice.title}</h1>
          </div>

          <div
            className="prose prose-sm max-w-none p-5 text-gray-700 dark:prose-invert dark:text-gray-300 prose-headings:font-bold prose-a:text-pink-500 prose-a:underline prose-blockquote:border-l-gray-300 prose-blockquote:text-gray-500"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(notice.content) }}
          />
        </article>
      </div>
    </div>
  );
}
