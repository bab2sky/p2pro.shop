import type { ReviewStats } from '@/lib/api/reviews';

interface RatingDistributionProps {
  stats: ReviewStats;
}

export default function RatingDistribution({ stats }: RatingDistributionProps) {
  const maxCount = Math.max(
    stats.distribution['5'],
    stats.distribution['4'],
    stats.distribution['3'],
    stats.distribution['2'],
    stats.distribution['1'],
    1,
  );

  return (
    <div className="flex items-start gap-6 p-4 bg-gray-50 rounded-lg">
      {/* Average */}
      <div className="text-center min-w-[80px]">
        <div className="text-4xl font-bold text-gray-900">{stats.avg_rating.toFixed(1)}</div>
        <div className="text-yellow-500 text-lg">
          {'★'.repeat(Math.round(stats.avg_rating))}
          {'☆'.repeat(5 - Math.round(stats.avg_rating))}
        </div>
        <div className="text-sm text-gray-500 mt-1">{stats.total_count}개 리뷰</div>
      </div>

      {/* Distribution bars */}
      <div className="flex-1 space-y-1">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = stats.distribution[String(star) as keyof typeof stats.distribution];
          const percent = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-gray-600">{star}</span>
              <span className="text-yellow-500">★</span>
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-8 text-right text-gray-500">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
