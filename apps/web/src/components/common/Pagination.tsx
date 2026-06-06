import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const btnBase = 'flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-colors';

  return (
    <nav className="mt-8 flex justify-center gap-1.5" role="navigation" aria-label="페이지 네비게이션">
      {currentPage > 1 && (
        <button onClick={() => onPageChange(currentPage - 1)} aria-label="이전 페이지" className={`${btnBase} bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className={`${btnBase} bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700`}>1</button>
          {start > 2 && <span className="flex h-9 w-9 items-center justify-center text-[13px] text-gray-400">...</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          aria-label={`${p} 페이지`}
          aria-current={p === currentPage ? 'page' : undefined}
          className={`${btnBase} ${
            p === currentPage
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="flex h-9 w-9 items-center justify-center text-[13px] text-gray-400">...</span>}
          <button onClick={() => onPageChange(totalPages)} className={`${btnBase} bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700`}>{totalPages}</button>
        </>
      )}
      {currentPage < totalPages && (
        <button onClick={() => onPageChange(currentPage + 1)} aria-label="다음 페이지" className={`${btnBase} bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700`}>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </nav>
  );
}
