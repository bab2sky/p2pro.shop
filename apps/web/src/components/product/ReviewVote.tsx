import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { voteReview } from '@/lib/api/reviews';
import { useTranslation } from 'react-i18next';

interface ReviewVoteProps {
  reviewId: string;
  helpfulCount: number;
  unhelpfulCount: number;
}

export default function ReviewVote({ reviewId, helpfulCount, unhelpfulCount }: ReviewVoteProps) {
  const { t } = useTranslation('common');
  const [counts, setCounts] = useState({ helpful: helpfulCount, unhelpful: unhelpfulCount });
  const [voted, setVoted] = useState(false);

  const voteMutation = useMutation({
    mutationFn: (isHelpful: boolean) => voteReview(reviewId, isHelpful),
    onSuccess: (res) => {
      setCounts({ helpful: res.data.helpful_count, unhelpful: res.data.unhelpful_count });
      setVoted(true);
    },
  });

  return (
    <div className="flex items-center gap-3 text-sm text-gray-500">
      <span>{t('legal.reviewHelpful', '이 리뷰가 도움이 되었나요?')}</span>
      <button
        onClick={() => voteMutation.mutate(true)}
        disabled={voted || voteMutation.isPending}
        className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
      >
        👍 {counts.helpful}
      </button>
      <button
        onClick={() => voteMutation.mutate(false)}
        disabled={voted || voteMutation.isPending}
        className="flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-red-50 disabled:opacity-50"
      >
        👎 {counts.unhelpful}
      </button>
    </div>
  );
}
