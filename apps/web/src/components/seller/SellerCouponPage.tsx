import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket,
  Plus,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Percent,
  DollarSign,
} from 'lucide-react';
import {
  getSellerCoupons,
  createSellerCoupon,
  deleteSellerCoupon,
  type Coupon,
  type CreateCouponRequest,
} from '@/lib/api/coupons';
import { confirmAction } from '@/lib/confirm';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

const initialForm: CreateCouponRequest = {
  name: '',
  code: '',
  discount_type: 'percent',
  discount_value: 0,
  min_order_amount: undefined,
  max_discount: undefined,
  max_uses: undefined,
  starts_at: new Date().toISOString().slice(0, 16),
  expires_at: '',
};

export default function SellerCouponPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateCouponRequest>({ ...initialForm });
  const [error, setError] = useState('');

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['seller-coupons'],
    queryFn: getSellerCoupons,
  });

  const createMut = useMutation({
    mutationFn: createSellerCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-coupons'] });
      setShowForm(false);
      setForm({ ...initialForm });
      setError('');
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      setError(e?.response?.data?.error?.message || '쿠폰 생성에 실패했습니다.'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteSellerCoupon,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller-coupons'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('쿠폰명을 입력하세요.');
    if (!form.code.trim()) return setError('쿠폰 코드를 입력하세요.');
    if (form.discount_value <= 0) return setError('할인 값을 입력하세요.');
    if (!form.expires_at) return setError('만료일을 입력하세요.');
    setError('');
    createMut.mutate({
      ...form,
      starts_at: new Date(form.starts_at).toISOString(),
      expires_at: new Date(form.expires_at).toISOString(),
    });
  };

  const updateField = <K extends keyof CreateCouponRequest>(key: K, value: CreateCouponRequest[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const activeCoupons = coupons.filter((c: Coupon) => c.is_active);
  const inactiveCoupons = coupons.filter((c: Coupon) => !c.is_active);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">쿠폰 관리</h1>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold transition-colors ${
            showForm
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
          }`}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? '취소' : '쿠폰 생성'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-900">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
            <Ticket className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{coupons.length}</p>
          <p className="text-[12px] font-medium text-gray-400">전체 쿠폰</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500">{activeCoupons.length}</p>
          <p className="text-[12px] font-medium text-gray-400">활성</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-4 text-center dark:bg-red-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{inactiveCoupons.length}</p>
          <p className="text-[12px] font-medium text-gray-400">비활성</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">새 쿠폰 생성</h3>
          </div>
          <div className="space-y-4 p-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">쿠폰명 *</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="예: 신규 회원 10% 할인"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">쿠폰 코드 *</label>
                <input
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  placeholder="예: WELCOME10"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">할인 유형 *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('discount_type', 'percent')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-colors ${
                      form.discount_type === 'percent'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Percent className="h-3.5 w-3.5" />
                    정률
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('discount_type', 'fixed')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-colors ${
                      form.discount_type === 'fixed'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    정액
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                  할인 값 * {form.discount_type === 'percent' ? '(%)' : '(USDT)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={form.discount_type === 'percent' ? 1 : 0.01}
                  value={form.discount_value || ''}
                  onChange={(e) => updateField('discount_value', Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">최대 할인 (USDT)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.max_discount ?? ''}
                  onChange={(e) => updateField('max_discount', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="제한 없음"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">최소 주문금액 (USDT)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.min_order_amount ?? ''}
                  onChange={(e) => updateField('min_order_amount', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="제한 없음"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">발급 수량</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_uses ?? ''}
                  onChange={(e) => updateField('max_uses', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="무제한"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">시작일 *</label>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => updateField('starts_at', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">만료일 *</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => updateField('expires_at', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="flex items-center gap-1.5 rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                <Plus className="h-3.5 w-3.5" />
                {createMut.isPending ? '생성 중...' : '쿠폰 생성'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Coupon List */}
      {isLoading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 88 }} />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Ticket className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">등록된 쿠폰이 없습니다.</p>
          <p className="mt-1 text-[12px] text-gray-400">쿠폰을 생성하여 판매를 촉진하세요!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon: Coupon) => (
            <div key={coupon.id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-900 px-3 py-0.5 font-mono text-[12px] font-bold text-white dark:bg-white dark:text-gray-900">
                      {coupon.code}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      coupon.is_active
                        ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {coupon.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{coupon.name}</p>
                  <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                    {coupon.discount_type === 'percent'
                      ? `${coupon.discount_value}% 할인`
                      : `${Number(coupon.discount_value).toLocaleString()} USDT 할인`}
                    {coupon.min_order_amount ? ` (${Number(coupon.min_order_amount).toLocaleString()} USDT 이상)` : ''}
                    {coupon.max_discount ? ` / 최대 ${Number(coupon.max_discount).toLocaleString()} USDT` : ''}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-gray-400">
                    <span>사용: <span className="font-bold text-gray-900 dark:text-white">{coupon.used_count}</span>{coupon.max_uses ? `/${coupon.max_uses}` : ''}</span>
                    <span>{new Date(coupon.starts_at).toLocaleDateString('ko-KR')} ~ {new Date(coupon.expires_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (await confirmAction('이 쿠폰을 삭제하시겠습니까?')) deleteMut.mutate(coupon.id);
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
