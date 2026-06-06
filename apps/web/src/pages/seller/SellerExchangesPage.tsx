import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { getSellerExchanges, respondExchange, type ExchangeRequest } from '@/lib/api/exchange';

export default function SellerExchangesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['seller', 'exchanges'], queryFn: () => getSellerExchanges() });

  const respondMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => respondExchange(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller', 'exchanges'] }),
  });

  const exchanges: ExchangeRequest[] = data?.data || [];

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">교환 관리</h1>

      {isLoading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
          ))}
        </div>
      ) : exchanges.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <ArrowLeftRight className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">교환 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exchanges.map((ex) => (
            <div key={ex.id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">주문: {ex.order_id}</p>
                  <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">사유: {ex.reason_code}</p>
                  {ex.reason_detail && <p className="mt-0.5 text-[12px] text-gray-400">{ex.reason_detail}</p>}
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  ex.status === 'pending' ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' :
                  ex.status === 'approved' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' :
                  'bg-red-50 text-red-500 dark:bg-red-500/10'
                }`}>
                  {ex.status === 'pending' ? <Clock className="h-3 w-3" /> : ex.status === 'approved' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {ex.status === 'pending' ? '대기' : ex.status === 'approved' ? '승인' : '거절'}
                </span>
              </div>
              {ex.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respondMut.mutate({ id: ex.id, status: 'approved' })}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    승인
                  </button>
                  <button
                    onClick={() => respondMut.mutate({ id: ex.id, status: 'rejected' })}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-red-50 py-2.5 text-[13px] font-bold text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    거절
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
