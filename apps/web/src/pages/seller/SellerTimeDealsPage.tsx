import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  Plus,
  Trash2,
  X,
  Clock,
  CheckCircle,
  Search,
} from 'lucide-react';
import api from '@/lib/api/client';
import { getSellerProducts, type ProductSummary } from '@/lib/api/products';
import { confirmAction } from '@/lib/confirm';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

interface TimeDeal {
  id: string;
  product_id: string;
  product_title: string;
  deal_price: string;
  original_price: string;
  discount_percent: number;
  max_quantity: number | null;
  sold_quantity: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected';
  rejected_reason?: string | null;
}

export default function SellerTimeDealsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product_id: '', deal_price: '', original_price: '', max_quantity: '', starts_at: '', ends_at: '' });
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const { data, isLoading } = useQuery<{ data: TimeDeal[] }>({
    queryKey: ['seller', 'timedeals'],
    queryFn: () => api.get('/seller/time-deals').then(r => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['seller', 'products', 'all'],
    queryFn: () => getSellerProducts({ per_page: 200 }),
    enabled: showForm,
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/seller/time-deals', {
      product_id: form.product_id,
      deal_price: form.deal_price,
      original_price: form.original_price,
      max_quantity: form.max_quantity ? parseInt(form.max_quantity) : null,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'timedeals'] });
      setShowForm(false);
      setForm({ product_id: '', deal_price: '', original_price: '', max_quantity: '', starts_at: '', ends_at: '' });
      setSearch('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/seller/time-deals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller', 'timedeals'] }),
  });

  const deals = data?.data || [];
  const products: ProductSummary[] = productsData?.data || [];
  const filteredProducts = search.trim()
    ? products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : products;
  const selectedProduct = products.find(p => p.id === form.product_id);

  const handleSelectProduct = (product: ProductSummary) => {
    setForm({ ...form, product_id: product.id, original_price: product.final_price });
    setSearch(product.title);
    setShowDropdown(false);
  };

  const pendingDeals = deals.filter(d => d.status === 'pending');
  const activeDeals = deals.filter(d => d.status === 'approved' && d.is_active);
  const endedDeals = deals.filter(d => d.status === 'rejected' || (!d.is_active && d.status !== 'pending'));
  const discountRate = form.original_price && form.deal_price && Number(form.original_price) > 0
    ? Math.round((1 - Number(form.deal_price) / Number(form.original_price)) * 100)
    : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">타임딜 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold transition-colors ${
            showForm
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
          }`}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? '취소' : '타임딜 생성'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-900">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
            <Zap className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{deals.length}</p>
          <p className="text-[12px] font-medium text-gray-400">전체</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-4 text-center dark:bg-amber-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-500">{pendingDeals.length}</p>
          <p className="text-[12px] font-medium text-gray-400">승인대기</p>
        </div>
        <div className="rounded-2xl bg-pink-50 p-4 text-center dark:bg-pink-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-500/20">
            <Zap className="h-4 w-4 text-pink-500" />
          </div>
          <p className="text-2xl font-bold text-pink-500">{activeDeals.length}</p>
          <p className="text-[12px] font-medium text-gray-400">진행중</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500">{endedDeals.length}</p>
          <p className="text-[12px] font-medium text-gray-400">종료</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">새 타임딜 생성</h3>
          </div>
          <div className="space-y-4 p-5">
            {/* Product search */}
            <div className="relative">
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">상품 선택 *</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  placeholder="상품명으로 검색..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setForm({ ...form, product_id: '' }); }}
                  onFocus={() => setShowDropdown(true)}
                  className={`${inputClass} pl-10`}
                />
              </div>
              {showDropdown && filteredProducts.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {filteredProducts.slice(0, 20).map(p => (
                    <li
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {p.main_image && (
                          <img src={p.main_image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                        )}
                        <span className="truncate text-gray-900 dark:text-white">{p.title}</span>
                      </div>
                      <span className="ml-2 shrink-0 font-bold text-pink-500">₮{p.final_price}</span>
                    </li>
                  ))}
                </ul>
              )}
              {selectedProduct && (
                <p className="mt-1.5 text-[12px] font-bold text-emerald-500">
                  선택됨: {selectedProduct.title} (₮{selectedProduct.final_price})
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">원가 (USDT)</label>
                <input
                  placeholder="원가"
                  value={form.original_price}
                  onChange={e => setForm({ ...form, original_price: e.target.value })}
                  className={`${inputClass} ${selectedProduct ? 'opacity-60' : ''}`}
                  readOnly={!!selectedProduct}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">딜가 (USDT) *</label>
                <input
                  placeholder="딜 특가"
                  value={form.deal_price}
                  onChange={e => setForm({ ...form, deal_price: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {discountRate !== null && (
              <div className="rounded-xl bg-pink-50 px-4 py-2.5 dark:bg-pink-500/10">
                <span className="text-sm font-bold text-pink-500">할인율: {discountRate}%</span>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">최대 수량</label>
              <input
                placeholder="빈칸 = 무제한"
                value={form.max_quantity}
                onChange={e => setForm({ ...form, max_quantity: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">시작일 *</label>
                <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">종료일 *</label>
                <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} className={inputClass} />
              </div>
            </div>

            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.product_id || !form.deal_price}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Zap className="h-3.5 w-3.5" />
              {createMut.isPending ? '생성 중...' : '타임딜 생성'}
            </button>
          </div>
        </div>
      )}

      {/* Deal List */}
      {isLoading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Zap className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">등록된 타임딜이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map(deal => (
            <div key={deal.id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{deal.product_title}</p>
                    <span className={`flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      deal.status === 'pending'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
                        : deal.status === 'approved'
                          ? 'bg-pink-50 text-pink-500 dark:bg-pink-500/10'
                          : 'bg-red-50 text-red-500 dark:bg-red-500/10'
                    }`}>
                      {deal.status === 'pending' ? <Clock className="h-3 w-3" /> : deal.status === 'approved' ? <Zap className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {deal.status === 'pending' ? '승인대기' : deal.status === 'approved' ? '승인됨' : '반려'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-gray-400 line-through">₮{deal.original_price}</span>
                    <span className="font-bold text-pink-500">₮{deal.deal_price}</span>
                    <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-500 dark:bg-pink-500/10">
                      {deal.discount_percent}% OFF
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-gray-400">
                    <span>판매: <span className="font-bold text-gray-900 dark:text-white">{deal.sold_quantity}</span>{deal.max_quantity ? `/${deal.max_quantity}` : ''}</span>
                    <span>{new Date(deal.starts_at).toLocaleDateString('ko-KR')} ~ {new Date(deal.ends_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {deal.status === 'rejected' && deal.rejected_reason && (
                    <p className="mt-1.5 text-[12px] text-red-500">반려 사유: {deal.rejected_reason}</p>
                  )}
                  {deal.status === 'pending' && (
                    <p className="mt-1.5 text-[12px] text-amber-600">관리자 승인을 기다리고 있습니다.</p>
                  )}
                </div>
                <button
                  onClick={async () => {
                    if (await confirmAction('이 타임딜을 삭제하시겠습니까?')) deleteMut.mutate(deal.id);
                  }}
                  className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
