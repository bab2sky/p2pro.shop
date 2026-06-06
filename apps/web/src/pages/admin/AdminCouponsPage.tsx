import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import { Ticket, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';

export function AdminCouponsPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-coupons', page],
    queryFn: async () => {
      const res = await api.get('/admin/coupons', { params: { page, per_page: 20 } });
      return res.data;
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/coupons/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, string | number | null>) => {
      const res = await api.post('/admin/coupons', body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setShowCreate(false);
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      code: fd.get('code') as string,
      name: fd.get('name') as string,
      discount_type: fd.get('discount_type') as string,
      discount_value: parseFloat(fd.get('discount_value') as string),
      max_discount: fd.get('max_discount') ? parseFloat(fd.get('max_discount') as string) : null,
      min_order_amount: fd.get('min_order_amount') ? parseFloat(fd.get('min_order_amount') as string) : null,
      max_uses: fd.get('max_uses') ? parseInt(fd.get('max_uses') as string) : null,
      expires_at: fd.get('expires_at') as string,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">쿠폰 관리</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
            showCreate
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
          }`}
        >
          {showCreate ? <><X className="h-4 w-4" /> 취소</> : <><Plus className="h-4 w-4" /> 쿠폰 생성</>}
        </button>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">새 쿠폰 생성</h3>
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">쿠폰 코드 *</label>
                <input name="code" placeholder="WELCOME2026" required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">쿠폰 이름 *</label>
                <input name="name" placeholder="신규 회원 할인" required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">할인 타입</label>
                <select name="discount_type" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <option value="percent">퍼센트</option>
                  <option value="fixed">정액</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">할인값 *</label>
                <input name="discount_value" type="number" step="0.01" placeholder="10" required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">최대 할인</label>
                <input name="max_discount" type="number" step="0.01" placeholder="선택" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">최소 주문금액</label>
                <input name="min_order_amount" type="number" step="0.01" placeholder="선택" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">최대 사용횟수</label>
                <input name="max_uses" type="number" placeholder="선택" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">만료일 *</label>
                <input name="expires_at" type="datetime-local" required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
              </div>
            </div>
            <button type="submit" disabled={createMutation.isPending} className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">코드</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">이름</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">타입</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">할인</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">사용/최대</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">만료일</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">액션</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((c: { id: string; code: string; name: string; discount_type: string; discount_value: number; used_count: number; max_uses: number | null; is_active: boolean; expires_at: string }) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-mono text-sm font-bold text-gray-900 dark:text-white">{c.code}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{c.name}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{c.discount_type === 'percent' ? '%' : 'USDT'}</td>
                  <td className="px-5 py-3 font-bold text-pink-500">{c.discount_value}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">{c.used_count}/{c.max_uses ?? '∞'}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {c.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{new Date(c.expires_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {c.is_active && (
                      <button
                        onClick={() => deactivateMutation.mutate(c.id)}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        비활성화
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Ticket className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                    <p className="mt-3 font-bold text-gray-400">쿠폰이 없습니다.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminCouponsPage;
