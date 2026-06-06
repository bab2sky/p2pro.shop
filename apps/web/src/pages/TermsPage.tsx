import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { sanitizeHtml } from '@/lib/sanitize';
import { FileText } from 'lucide-react';
import { getTermsOfService } from '@/lib/api/legal';
import { SimplePageHeader } from '@/components/layout/SimplePageHeader';

export default function TermsPage() {
  const { t } = useTranslation();
  const { data: content, isLoading } = useQuery({
    queryKey: ['legal', 'terms'],
    queryFn: getTermsOfService,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <SimplePageHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
          <FileText className="h-5 w-5" />
          {t('common.termsOfService')}
        </h1>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : content ? (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div
              className="prose prose-sm max-w-none text-gray-700 dark:prose-invert dark:text-gray-300 prose-headings:font-bold prose-a:text-pink-500 prose-a:underline prose-blockquote:border-l-gray-300 prose-blockquote:text-gray-500"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <FileText className="mx-auto mb-3 h-14 w-14 text-gray-200 dark:text-gray-700" />
            <p className="text-sm font-bold text-gray-400">이용약관이 등록되지 않았습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
