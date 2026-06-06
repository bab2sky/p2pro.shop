import type { ReviewStats as ReviewStatsType } from '@/lib/api/reviews';
import { StarRating } from './StarRating';
import { Star } from 'lucide-react';

interface ReviewStatsProps {
  stats: ReviewStatsType;
}

export function ReviewStats({ stats }: ReviewStatsProps) {
  const { avg_rating, total_count, distribution } = stats;

  const bars = [
    { label: '5', count: distribution['5'] },
    { label: '4', count: distribution['4'] },
    { label: '3', count: distribution['3'] },
    { label: '2', count: distribution['2'] },
    { label: '1', count: distribution['1'] },
  ];

  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-gray-50 p-6 dark:bg-gray-900 sm:flex-row sm:gap-10">
      {/* Left: Average Rating */}
      <div className="flex flex-col items-center justify-center gap-1.5 sm:min-w-[140px]">
        <span className="text-[48px] font-black leading-none text-gray-900 dark:text-white">
          {avg_rating.toFixed(1)}
        </span>
        <StarRating value={Math.round(avg_rating)} readonly size="md" />
        <span className="mt-1 text-[13px] text-gray-400">
          {total_count.toLocaleString()}개의 리뷰
        </span>
      </div>

      {/* Right: Distribution Bars */}
      <div className="flex flex-1 flex-col gap-2">
        {bars.map((bar) => {
          const pct = total_count > 0 ? Math.round((bar.count / total_count) * 100) : 0;
          return (
            <div key={bar.label} className="flex items-center gap-2.5">
              <div className="flex w-8 items-center gap-0.5 text-[13px] font-bold text-gray-600 dark:text-gray-400">
                {bar.label}
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${(bar.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-[12px] text-gray-400">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
