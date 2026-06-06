import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Check, X, Clock, AlertCircle } from 'lucide-react';
import api from '@/lib/api/client';

type Status = 'all' | 'pending' | 'approved' | 'rejected';

interface AdminTimeDeal {
  id: string;
  product_id: string;
  product_title: string;
  seller_name: string;
  deal_price: string;
  original_price: string;
  discount_percent: number;
  max_quantity: number | null;
  sold_quantity: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  status: string;
  rejected_reason: string | null;
  created_at: string | null;
}

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인대기' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '반려' },
];

export default function AdminTimeDealsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'time-deals', status, page],
    queryFn: () =>
      api.get('/admin/time-deals', { params: { status, page, per_page: 20 } }).then((r) => r.data),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.put(`/admin/time-deals/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'time-deals'] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.put(`/admin/time-deals/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'time-deals'] });
      setRejectId(null);
      setRejectReason('');
    },
  });

  const deals: AdminTimeDeal[] = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">타임딜 관리</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">판매자가 신청한 타임딜을 승인하거나 반려합니다.</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              status === t.key
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && deals.length === 0 && (
        <div className="flex flex-col items-center py-16">
          <Zap className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">해당 상태의 타임딜이 없습니다.</p>
        </div>
      )}

      {/* Deal List */}
      {deals.length > 0 && (
        <div className="space-y-3">
          {deals.map((deal) => (
            <div key={deal.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{deal.product_title}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      deal.status === 'pending'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
                        : deal.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                          : 'bg-red-50 text-red-500 dark:bg-red-500/10'
                    }`}>
                      {deal.status === 'pending' ? '승인대기' : deal.status === 'approved' ? '승인됨' : '반려'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    판매자: <span className="font-bold text-gray-700 dark:text-gray-300">{deal.seller_name}</span>
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-gray-400 line-through">{parseFloat(deal.original_price).toLocaleString()}</span>
                    <span className="font-bold text-red-500">{parseFloat(deal.deal_price).toLocaleString()} USDT</span>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-500 dark:bg-red-500/10">
                      -{deal.discount_percent}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(deal.starts_at).toLocaleDateString('ko-KR')} ~ {new Date(deal.ends_at).toLocaleDateString('ko-KR')}
                    </span>
                    {deal.max_quantity && <span>한정 {deal.max_quantity}개 (판매 {deal.sold_quantity}개)</span>}
                    {deal.created_at && <span>신청일: {new Date(deal.created_at).toLocaleDateString('ko-KR')}</span>}
                  </div>
                  {deal.rejected_reason && (
                    <p className="mt-1.5 text-[12px] text-red-500">반려 사유: {deal.rejected_reason}</p>
                  )}
                </div>

                {/* Actions */}
                {deal.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => approveMut.mutate(deal.id)}
                      disabled={approveMut.isPending}
                      className="flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      승인
                    </button>
                    <button
                      onClick={() => setRejectId(deal.id)}
                      className="flex items-center gap-1 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                      반려
                    </button>
                  </div>
                )}
              </div>

              {/* Reject reason input */}
              {rejectId === deal.id && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
                  <div className="mb-2 flex items-center gap-1 text-sm font-bold text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    반려 사유
                  </div>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="반려 사유를 입력하세요..."
                    autoFocus
                    className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300 dark:border-red-800 dark:bg-gray-900 dark:text-white"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => rejectMut.mutate({ id: deal.id, reason: rejectReason })}
                      disabled={rejectMut.isPending}
                      className="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {rejectMut.isPending ? '처리 중...' : '반려 확인'}
                    </button>
                    <button
                      onClick={() => { setRejectId(null); setRejectReason(''); }}
                      className="rounded-lg bg-gray-200 px-4 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            이전
          </button>
          <span className="flex items-center px-3 text-sm text-gray-500">
            {page} / {Math.ceil(pagination.total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= pagination.total}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
