import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Star,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { getSellerReviews, replyReview, type SellerReview } from '@/lib/api/seller';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? 'fill-amber-400' : 'fill-none text-gray-300 dark:text-gray-600'}`} />
      ))}
    </span>
  );
}

function ReviewCard({ review, t }: { review: SellerReview; t: (key: string) => string }) {
  const { t: tc } = useTranslation('common');
  const queryClient = useQueryClient();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState(review.seller_reply || '');
  const [editingReply, setEditingReply] = useState(false);

  const replyMut = useMutation({
    mutationFn: (reply: string) => replyReview(review.id, reply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerReviews'] });
      setShowReplyForm(false);
      setEditingReply(false);
    },
  });

  const handleSubmitReply = () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    replyMut.mutate(trimmed);
  };

  const hasReply = !!review.seller_reply;

  const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none resize-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <Link
              to={`/products/${review.product_id}`}
              className="text-sm font-bold text-gray-900 hover:text-pink-500 dark:text-white dark:hover:text-pink-400"
            >
              {review.product_title}
            </Link>
            <div className="mt-1.5 flex items-center gap-2">
              <StarRating rating={review.rating} />
              <span className="text-[12px] text-gray-400">{review.user_nickname}</span>
            </div>
          </div>
          <span className="text-[12px] text-gray-400">
            {new Date(review.created_at).toLocaleDateString('ko')}
          </span>
        </div>
        {review.content && (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{review.content}</p>
        )}
      </div>

      {hasReply && !editingReply ? (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/50">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-bold text-gray-900 dark:text-white">{t('reviews.sellerReply')}</span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-400">
                {review.seller_replied_at && new Date(review.seller_replied_at).toLocaleDateString('ko')}
              </span>
              <button
                onClick={() => { setEditingReply(true); setReplyText(review.seller_reply || ''); }}
                className="flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
              >
                <Pencil className="h-3 w-3" />
                {t('reviews.editReply')}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{review.seller_reply}</p>
        </div>
      ) : editingReply ? (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/50">
          <label className="mb-2 block text-[12px] font-bold text-gray-900 dark:text-white">{t('reviews.editReplyTitle')}</label>
          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className={inputClass} rows={3} placeholder={t('reviews.editPlaceholder')} />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setEditingReply(false)} className="rounded-full bg-gray-200 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">{tc('cancel')}</button>
            <button onClick={handleSubmitReply} disabled={replyMut.isPending || !replyText.trim()} className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">{replyMut.isPending ? t('reviews.saving') : t('reviews.editReply')}</button>
          </div>
          {replyMut.isError && <p className="mt-1 text-[12px] text-red-500">{t('reviews.replyError')}</p>}
        </div>
      ) : showReplyForm ? (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/50">
          <label className="mb-2 block text-[12px] font-bold text-gray-900 dark:text-white">{t('reviews.writeReplyTitle')}</label>
          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className={inputClass} rows={3} placeholder={t('reviews.replyPlaceholder')} autoFocus />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setShowReplyForm(false); setReplyText(''); }} className="rounded-full bg-gray-200 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">{tc('cancel')}</button>
            <button onClick={handleSubmitReply} disabled={replyMut.isPending || !replyText.trim()} className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">{replyMut.isPending ? t('reviews.submitting') : t('reviews.submitReply')}</button>
          </div>
          {replyMut.isError && <p className="mt-1 text-[12px] text-red-500">{t('reviews.replyError')}</p>}
        </div>
      ) : (
        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            onClick={() => setShowReplyForm(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t('reviews.writeReply')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SellerReviewsPage() {
  const { t } = useTranslation('seller');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const [filter, setFilter] = useState<'all' | 'replied' | 'unreplied'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['sellerReviews', page],
    queryFn: () => getSellerReviews({ page, per_page: 20 }),
  });

  if (isLoading)
    return (
      <div className="max-w-6xl space-y-3 py-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 100 }} />
        ))}
      </div>
    );

  const allReviews = data?.data ?? [];
  const reviews = filter === 'all' ? allReviews : filter === 'replied' ? allReviews.filter((r) => r.seller_reply) : allReviews.filter((r) => !r.seller_reply);

  const repliedCount = allReviews.filter((r) => r.seller_reply).length;
  const unrepliedCount = allReviews.filter((r) => !r.seller_reply).length;

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">{t('reviews.title')}</h1>

      {/* Stats summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-900">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
            <MessageCircle className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.pagination.total ?? 0}</p>
          <p className="text-[12px] font-medium text-gray-400">{t('reviews.totalReviews')}</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-4 text-center dark:bg-amber-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-500">
            {allReviews.length > 0 ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1) : '-'}
          </p>
          <p className="text-[12px] font-medium text-gray-400">{t('reviews.avgRating')}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500">{repliedCount}</p>
          <p className="text-[12px] font-medium text-gray-400">{t('reviews.replied')}</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-4 text-center dark:bg-red-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{unrepliedCount}</p>
          <p className="text-[12px] font-medium text-gray-400">{t('reviews.unreplied')}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2">
        {([
          { key: 'all' as const, label: t('reviews.filterAll'), count: allReviews.length },
          { key: 'unreplied' as const, label: t('reviews.filterUnreplied'), count: unrepliedCount },
          { key: 'replied' as const, label: t('reviews.filterReplied'), count: repliedCount },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
            <span className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
              filter === tab.key ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900' : 'bg-pink-500 text-white'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Star className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {filter === 'all' ? t('reviews.noReviewsAll') : filter === 'unreplied' ? t('reviews.noReviewsUnreplied') : t('reviews.noReviewsReplied')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} t={t} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.total_pages > 1 && (
        <div className="mt-8 flex justify-center gap-1.5">
          {Array.from({ length: data.pagination.total_pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => { searchParams.set('page', String(p)); setSearchParams(searchParams); }}
              className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                p === page ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
