import { useTranslation } from 'react-i18next';
import type { ReviewFilterParams } from '@/lib/api/reviews';

interface ReviewFilterProps {
  filters: ReviewFilterParams;
  onChange: (filters: ReviewFilterParams) => void;
}

const SORT_OPTIONS = [
  { value: 'latest', labelKey: 'latest' },
  { value: 'rating_high', labelKey: 'ratingHigh' },
  { value: 'rating_low', labelKey: 'ratingLow' },
  { value: 'helpful', labelKey: 'helpful' },
] as const;

export default function ReviewFilter({ filters, onChange }: ReviewFilterProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-gray-200">
      {/* Rating filter */}
      <div className="flex items-center gap-1">
        {[5, 4, 3, 2, 1].map((star) => (
          <button
            key={star}
            onClick={() => onChange({ ...filters, rating: filters.rating === star ? undefined : star, page: 1 })}
            className={`px-2 py-1 text-sm rounded border ${
              filters.rating === star
                ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {'⭐'.repeat(star)}
          </button>
        ))}
      </div>

      {/* Photo reviews only */}
      <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.has_images === true}
          onChange={(e) => onChange({ ...filters, has_images: e.target.checked || undefined, page: 1 })}
          className="rounded"
        />
        {t('legal.photoReviews', '사진 리뷰만')}
      </label>

      {/* Sort */}
      <select
        value={filters.sort || 'latest'}
        onChange={(e) => onChange({ ...filters, sort: e.target.value as ReviewFilterParams['sort'], page: 1 })}
        className="ml-auto text-sm border border-gray-300 rounded px-2 py-1"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(`legal.sort_${opt.value}`, opt.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
