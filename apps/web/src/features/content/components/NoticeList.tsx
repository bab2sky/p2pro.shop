import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pin, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { getNotices, type Notice } from '@/lib/api/content';

export function NoticeList() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notices', page],
    queryFn: () => getNotices(page),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  const notices: Notice[] = data?.data ?? [];
  const pagination = data?.pagination;

  if (notices.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
        <FileText className="mx-auto mb-3 h-14 w-14 text-gray-200 dark:text-gray-700" />
        <p className="text-sm font-bold text-gray-400">등록된 공지사항이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {notices.map((notice, i) => (
          <Link
            key={notice.id}
            to={`/notices/${notice.id}`}
            className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
              i < notices.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
            }`}
          >
            {notice.is_pinned && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-500/10">
                <Pin className="h-3 w-3" />
                고정
              </span>
            )}
            <span className={`flex-1 truncate text-base ${notice.is_pinned ? 'font-bold' : 'font-medium'} text-gray-900 dark:text-gray-200`}>
              {notice.title}
            </span>
            <span className="shrink-0 text-[12px] text-gray-400">
              {notice.created_at ? new Date(notice.created_at).toLocaleDateString() : ''}
            </span>
          </Link>
        ))}
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">
            {page} / {pagination.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
