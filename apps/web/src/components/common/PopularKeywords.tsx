import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react';
import { getPopularKeywords } from '@/lib/api/search';
import { useNavigate } from 'react-router-dom';

interface PopularKeywordsProps {
  period?: 'daily' | 'weekly';
  onSelect?: (keyword: string) => void;
}

export default function PopularKeywords({ period = 'daily', onSelect }: PopularKeywordsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['popular-keywords', period],
    queryFn: () => getPopularKeywords(period),
    staleTime: 60_000,
  });

  const keywords = data?.data ?? [];
  if (keywords.length === 0) return null;

  const handleClick = (keyword: string) => {
    if (onSelect) {
      onSelect(keyword);
    } else {
      navigate(`/search?q=${encodeURIComponent(keyword)}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
        <Flame className="h-4 w-4 text-pink-500" />
        {t('common.legal.popularKeywords', '인기 검색어')}
      </h3>
      <ol className="space-y-1">
        {keywords.map((kw) => (
          <li key={kw.rank} className="flex items-center gap-3">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              kw.rank <= 3
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
            }`}>
              {kw.rank}
            </span>
            <button
              onClick={() => handleClick(kw.keyword)}
              className="truncate text-[13px] font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              {kw.keyword}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
