import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  MapPin,
  CreditCard,
  Hash,
} from 'lucide-react';
import { getSellerOrders, registerShipping, type SellerOrderSummary } from '@/lib/api/orders';

const CARRIERS: Record<string, string> = {
  cj: 'CJ대한통운',
  hanjin: '한진택배',
  lotte: '롯데택배',
  logen: '로젠택배',
  post: '우체국택배',
  epost: 'EMS',
  kdexp: '경동택배',
};

const STATUS_FILTERS = [
  { value: undefined, label: '전체' },
  { value: 'pending_payment', label: '결제대기' },
  { value: 'txid_submitted', label: 'TXID 제출' },
  { value: 'verifying', label: 'TXID 검증중' },
  { value: 'payment_verified', label: '결제확인(발송대기)' },
  { value: 'shipped', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'confirmed', label: '구매확정' },
  { value: 'cancelled', label: '취소' },
  { value: 'disputed', label: '분쟁' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_payment: { label: '결제대기', color: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' },
  txid_submitted: { label: 'TXID 제출', color: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10' },
  verifying: { label: 'TXID 검증중', color: 'bg-purple-50 text-purple-500 dark:bg-purple-500/10' },
  payment_verified: { label: '결제확인', color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
  payment_rejected: { label: '결제거부', color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
  paid: { label: '결제완료', color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
  shipped: { label: '배송중', color: 'bg-pink-50 text-pink-500 dark:bg-pink-500/10' },
  delivered: { label: '배송완료', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  confirmed: { label: '구매확정', color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
  cancelled: { label: '취소', color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
  refunded: { label: '환불', color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
  disputed: { label: '분쟁', color: 'bg-orange-50 text-orange-500 dark:bg-orange-500/10' },
};

const TXID_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '검증대기', color: 'text-amber-500' },
  verified: { label: '검증완료', color: 'text-emerald-500' },
  rejected: { label: '검증실패', color: 'text-red-500' },
};

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function SellerOrdersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [shippingModal, setShippingModal] = useState<string | null>(null);
  const [carrier, setCarrier] = useState('cj');
  const [trackingNumber, setTrackingNumber] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sellerOrders', page, statusFilter],
    queryFn: () => getSellerOrders({ page, per_page: 20, status: statusFilter }),
  });

  const shippingMutation = useMutation({
    mutationFn: (orderId: string) =>
      registerShipping(orderId, {
        carrier_code: carrier,
        carrier_name: CARRIERS[carrier] || carrier,
        tracking_number: trackingNumber,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerOrders'] });
      queryClient.invalidateQueries({ queryKey: ['sellerDashboardStats'] });
      setShippingModal(null);
      setTrackingNumber('');
    },
  });

  const orders = data?.data ?? [];

  const summary = {
    total: data?.pagination?.total ?? 0,
    pending: orders.filter((o) => o.status === 'payment_verified').length,
    shipping: orders.filter((o) => o.status === 'shipped').length,
    txidWaiting: orders.filter((o) => ['txid_submitted', 'verifying'].includes(o.status)).length,
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">주문 관리</h1>
        <div className="flex gap-2">
          <Link
            to="/seller/orders/shipping"
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Truck className="h-3.5 w-3.5" />
            배송관리
          </Link>
          <Link
            to="/seller/orders/confirm"
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            구매확정관리
          </Link>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-900">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
            <ShoppingBag className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
          <p className="text-[12px] font-medium text-gray-400">전체 주문</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-4 text-center dark:bg-amber-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-500">{summary.txidWaiting}</p>
          <p className="text-[12px] font-medium text-gray-400">TXID 확인대기</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-4 text-center dark:bg-red-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{summary.pending}</p>
          <p className="text-[12px] font-medium text-gray-400">발송대기</p>
        </div>
        <div className="rounded-2xl bg-pink-50 p-4 text-center dark:bg-pink-500/10">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-500/20">
            <Truck className="h-4 w-4 text-pink-500" />
          </div>
          <p className="text-2xl font-bold text-pink-500">{summary.shipping}</p>
          <p className="text-[12px] font-medium text-gray-400">배송중</p>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value ?? 'all'}
            onClick={() => {
              setStatusFilter(f.value);
              searchParams.delete('page');
              setSearchParams(searchParams);
            }}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <ShoppingBag className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {statusFilter ? '해당 상태의 주문이 없습니다.' : '아직 주문이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <tr>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">주문번호</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">상품</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">구매자</th>
                  <th className="px-5 py-3 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">결제금액</th>
                  <th className="px-5 py-3 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">결제상태</th>
                  <th className="px-5 py-3 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">주문상태</th>
                  <th className="px-5 py-3 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">배송</th>
                  <th className="px-5 py-3 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">주문일</th>
                  <th className="px-5 py-3 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {orders.map((order) => {
                  const st = STATUS_MAP[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
                  const txSt = order.verification_status ? TXID_STATUS_MAP[order.verification_status] : null;
                  const isExpanded = expandedOrder === order.id;

                  return (
                    <OrderRow
                      key={order.id}
                      order={order}
                      st={st}
                      txSt={txSt}
                      isExpanded={isExpanded}
                      onToggleExpand={() => setExpandedOrder(isExpanded ? null : order.id)}
                      onShip={() => {
                        setShippingModal(order.id);
                        setCarrier('cj');
                        setTrackingNumber('');
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 페이지네이션 */}
      {data?.pagination && data.pagination.total_pages > 1 && (
        <div className="mt-8 flex justify-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => { searchParams.set('page', String(page - 1)); setSearchParams(searchParams); }}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400"
          >
            이전
          </button>
          {Array.from({ length: data.pagination.total_pages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 3 || p === 1 || p === data.pagination.total_pages)
            .map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                <button
                  onClick={() => { searchParams.set('page', String(p)); setSearchParams(searchParams); }}
                  className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                    p === page
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            disabled={page >= data.pagination.total_pages}
            onClick={() => { searchParams.set('page', String(page + 1)); setSearchParams(searchParams); }}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400"
          >
            다음
          </button>
        </div>
      )}

      {/* 배송 등록 모달 */}
      {shippingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShippingModal(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">배송 등록</h3>
              <button onClick={() => setShippingModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-5 text-[13px] text-gray-500 dark:text-gray-400">
              주문번호: {orders.find((o) => o.id === shippingModal)?.order_number}
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">택배사</label>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
                  {Object.entries(CARRIERS).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">운송장 번호</label>
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="운송장 번호를 입력하세요"
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShippingModal(null)}
                  className="rounded-full bg-gray-100 px-5 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={() => shippingMutation.mutate(shippingModal)}
                  disabled={!trackingNumber.trim() || shippingMutation.isPending}
                  className="rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  {shippingMutation.isPending ? '처리중...' : '발송처리'}
                </button>
              </div>
              {shippingMutation.isError && (
                <p className="text-center text-[13px] text-red-500">배송 등록에 실패했습니다. 주문 상태를 확인해주세요.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  st,
  txSt,
  isExpanded,
  onToggleExpand,
  onShip,
}: {
  order: SellerOrderSummary;
  st: { label: string; color: string };
  txSt: { label: string; color: string } | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onShip: () => void;
}) {
  const canShip = order.status === 'payment_verified';
  const hasShipping = !!order.tracking_number;

  return (
    <>
      <tr className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={onToggleExpand}>
        <td className="px-5 py-3">
          <Link
            to={`/seller/orders/${order.id}`}
            className="text-sm font-bold text-gray-900 hover:text-pink-500 dark:text-white dark:hover:text-pink-400"
            onClick={(e) => e.stopPropagation()}
          >
            {order.order_number}
          </Link>
        </td>
        <td className="px-5 py-3">
          <p className="max-w-[180px] truncate text-sm text-gray-700 dark:text-gray-300">
            {order.first_item_title}
            {order.item_count > 1 && <span className="text-gray-400"> 외 {order.item_count - 1}건</span>}
          </p>
        </td>
        <td className="px-5 py-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">{order.buyer_nickname || '-'}</p>
          <p className="text-[12px] text-gray-400">{order.recipient_name}</p>
        </td>
        <td className="px-5 py-3 text-right">
          <span className="whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">₮ {order.total_amount}</span>
        </td>
        <td className="px-5 py-3 text-center">
          {order.txid ? (
            <span className={`text-[12px] font-bold ${txSt?.color ?? 'text-gray-500'}`}>
              {txSt?.label ?? 'TXID 제출'}
            </span>
          ) : (
            <span className="text-[12px] text-gray-400">미입금</span>
          )}
        </td>
        <td className="px-5 py-3 text-center">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.color}`}>{st.label}</span>
        </td>
        <td className="px-5 py-3 text-center">
          {hasShipping ? (
            <div className="text-[12px]">
              <p className="text-gray-700 dark:text-gray-300">{order.carrier_name}</p>
              <p className="font-mono text-gray-400">{order.tracking_number}</p>
            </div>
          ) : canShip ? (
            <button
              onClick={(e) => { e.stopPropagation(); onShip(); }}
              className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              발송처리
            </button>
          ) : (
            <span className="text-[12px] text-gray-400">-</span>
          )}
        </td>
        <td className="px-5 py-3 text-right">
          <span className="whitespace-nowrap text-[12px] text-gray-400">{new Date(order.created_at).toLocaleDateString('ko')}</span>
        </td>
        <td className="px-5 py-3 text-center">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-50/50 dark:bg-gray-800/30">
          <td colSpan={9} className="px-5 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 dark:bg-gray-900">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">배송정보</h4>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">수령인</dt>
                    <dd className="font-medium text-gray-700 dark:text-gray-300">{order.recipient_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">연락처</dt>
                    <dd className="font-medium text-gray-700 dark:text-gray-300">{order.recipient_phone}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl bg-white p-4 dark:bg-gray-900">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">결제정보</h4>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">상품금액</dt>
                    <dd className="text-gray-700 dark:text-gray-300">₮ {order.subtotal}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">배송비</dt>
                    <dd className="text-gray-700 dark:text-gray-300">₮ {order.shipping_fee}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">마진</dt>
                    <dd className="text-gray-700 dark:text-gray-300">₮ {order.margin_amount}</dd>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-1.5 dark:border-gray-800">
                    <dt className="font-bold text-gray-900 dark:text-white">합계</dt>
                    <dd className="font-bold text-pink-500">₮ {order.total_amount}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl bg-white p-4 dark:bg-gray-900">
                <div className="mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">TXID / 배송추적</h4>
                </div>
                {order.txid ? (
                  <div className="mb-2">
                    <p className="mb-0.5 text-[12px] text-gray-400">TXID</p>
                    <p className="break-all rounded-xl bg-gray-50 p-2 font-mono text-[12px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">{order.txid}</p>
                    {txSt && <p className={`mt-1 text-[12px] font-bold ${txSt.color}`}>검증상태: {txSt.label}</p>}
                  </div>
                ) : (
                  <p className="mb-2 text-[12px] text-gray-400">TXID 미제출</p>
                )}
                {hasShipping && (
                  <div>
                    <p className="mb-0.5 text-[12px] text-gray-400">운송장</p>
                    <p className="text-[12px] text-gray-700 dark:text-gray-300">
                      {order.carrier_name} | <span className="font-mono">{order.tracking_number}</span>
                    </p>
                    {order.shipped_at && <p className="text-[12px] text-gray-400">발송일: {new Date(order.shipped_at).toLocaleString('ko')}</p>}
                    {order.delivered_at && <p className="text-[12px] font-medium text-emerald-500">배송완료: {new Date(order.delivered_at).toLocaleString('ko')}</p>}
                  </div>
                )}
                {order.auto_confirm_at && !order.confirmed_at && (
                  <p className="mt-1 text-[12px] text-orange-500">자동확정: {new Date(order.auto_confirm_at).toLocaleDateString('ko')}</p>
                )}
                {order.confirmed_at && (
                  <p className="mt-1 text-[12px] font-medium text-emerald-500">확정일: {new Date(order.confirmed_at).toLocaleString('ko')}</p>
                )}
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              {canShip && (
                <button
                  onClick={onShip}
                  className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  발송처리
                </button>
              )}
              <Link
                to={`/seller/orders/${order.id}`}
                className="flex items-center gap-1 rounded-full bg-gray-100 px-5 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                상세보기 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
