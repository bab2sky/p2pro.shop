import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  CheckCircle,
  Clock,
  Package,
  FileSpreadsheet,
  X,
  Monitor,
  Car,
} from 'lucide-react';
import { getSellerOrders, registerShipping, bulkRegisterShipping } from '@/lib/api/orders';
import { BulkShippingUpload } from '@/components/seller/BulkShippingUpload';

const CARRIERS: Record<string, string> = {
  cj: 'CJ대한통운',
  hanjin: '한진택배',
  lotte: '롯데택배',
  logen: '로젠택배',
  post: '우체국택배',
  epost: 'EMS (국제)',
  kdexp: '경동택배',
  direct: '직접배송',
  digital: '온라인배송 (디지털)',
};

const PARCEL_CARRIERS = ['cj', 'hanjin', 'lotte', 'logen', 'post', 'epost', 'kdexp'];

const STATUS_TABS = [
  { value: 'payment_verified', label: '발송대기', icon: <Clock className="h-3.5 w-3.5" /> },
  { value: 'shipped', label: '배송중', icon: <Truck className="h-3.5 w-3.5" /> },
  { value: 'delivered', label: '배송완료', icon: <CheckCircle className="h-3.5 w-3.5" /> },
];

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function SellerShippingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('payment_verified');
  const [showBulk, setShowBulk] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [shippingForm, setShippingForm] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<'parcel' | 'direct' | 'digital'>('parcel');
  const [carrier, setCarrier] = useState('cj');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [digitalNote, setDigitalNote] = useState('');

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCarrier, setBatchCarrier] = useState('cj');
  const [batchType, setBatchType] = useState<'parcel' | 'direct' | 'digital'>('parcel');
  const [batchTrackings, setBatchTrackings] = useState<Record<string, string>>({});

  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const { data: pendingData } = useQuery({
    queryKey: ['sellerOrders', 'shipping-count', 'payment_verified'],
    queryFn: () => getSellerOrders({ per_page: 1, status: 'payment_verified' }),
  });
  const { data: shippingCountData } = useQuery({
    queryKey: ['sellerOrders', 'shipping-count', 'shipped'],
    queryFn: () => getSellerOrders({ per_page: 1, status: 'shipped' }),
  });
  const { data: deliveredCountData } = useQuery({
    queryKey: ['sellerOrders', 'shipping-count', 'delivered'],
    queryFn: () => getSellerOrders({ per_page: 1, status: 'delivered' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sellerOrders', 'shipping', activeTab],
    queryFn: () => getSellerOrders({ per_page: 100, status: activeTab }),
  });

  const orders = data?.data ?? [];
  const pendingCount = pendingData?.pagination?.total ?? 0;
  const shippingCount = shippingCountData?.pagination?.total ?? 0;
  const deliveredCount = deliveredCountData?.pagination?.total ?? 0;

  const shippingMutation = useMutation({
    mutationFn: (orderId: string) => {
      const { code, name, tracking } = resolveShipping(deliveryType, carrier, trackingNumber, digitalNote);
      return registerShipping(orderId, { carrier_code: code, carrier_name: name, tracking_number: tracking });
    },
    onSuccess: () => {
      invalidateAll();
      resetForm();
    },
  });

  const batchMutation = useMutation({
    mutationFn: () => {
      const items = Array.from(selected).map((orderId) => {
        if (batchType === 'digital') {
          return { order_id: orderId, carrier_code: 'digital', carrier_name: '온라인배송 (디지털)', tracking_number: '디지털 상품 발송완료' };
        }
        if (batchType === 'direct') {
          return { order_id: orderId, carrier_code: 'direct', carrier_name: '직접배송', tracking_number: batchTrackings[orderId] || '직접배송' };
        }
        return {
          order_id: orderId,
          carrier_code: batchCarrier,
          carrier_name: CARRIERS[batchCarrier] || batchCarrier,
          tracking_number: batchTrackings[orderId] || '',
        };
      }).filter((item) => batchType !== 'parcel' || item.tracking_number.trim());

      return bulkRegisterShipping(items);
    },
    onSuccess: () => {
      invalidateAll();
      setShowBatchModal(false);
      setSelected(new Set());
      setBatchTrackings({});
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sellerOrders'] });
    queryClient.invalidateQueries({ queryKey: ['sellerDashboardStats'] });
  };

  const resetForm = () => {
    setShippingForm(null);
    setDeliveryType('parcel');
    setCarrier('cj');
    setTrackingNumber('');
    setDigitalNote('');
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  };

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canSubmitSingle = deliveryType === 'digital' || deliveryType === 'direct' || trackingNumber.trim().length > 0;

  const batchFilledCount = useMemo(() => {
    if (batchType !== 'parcel') return selected.size;
    return Array.from(selected).filter((id) => batchTrackings[id]?.trim()).length;
  }, [selected, batchTrackings, batchType]);

  return (
    <div className="max-w-6xl">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">배송관리</h1>
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          {showBulk ? '닫기' : '엑셀 대량등록'}
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <button
          onClick={() => setActiveTab('payment_verified')}
          className={`rounded-2xl p-4 text-center transition-all ${
            activeTab === 'payment_verified'
              ? 'bg-red-50 ring-2 ring-red-300 dark:bg-red-500/10 dark:ring-red-500/30'
              : 'bg-red-50/50 hover:bg-red-50 dark:bg-red-500/5 dark:hover:bg-red-500/10'
          }`}
        >
          <p className="text-2xl font-bold text-red-500">{pendingCount}</p>
          <p className="text-[12px] font-medium text-gray-400">발송대기</p>
        </button>
        <button
          onClick={() => setActiveTab('shipped')}
          className={`rounded-2xl p-4 text-center transition-all ${
            activeTab === 'shipped'
              ? 'bg-pink-50 ring-2 ring-pink-300 dark:bg-pink-500/10 dark:ring-pink-500/30'
              : 'bg-pink-50/50 hover:bg-pink-50 dark:bg-pink-500/5 dark:hover:bg-pink-500/10'
          }`}
        >
          <p className="text-2xl font-bold text-pink-500">{shippingCount}</p>
          <p className="text-[12px] font-medium text-gray-400">배송중</p>
        </button>
        <button
          onClick={() => setActiveTab('delivered')}
          className={`rounded-2xl p-4 text-center transition-all ${
            activeTab === 'delivered'
              ? 'bg-emerald-50 ring-2 ring-emerald-300 dark:bg-emerald-500/10 dark:ring-emerald-500/30'
              : 'bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10'
          }`}
        >
          <p className="text-2xl font-bold text-emerald-500">{deliveredCount}</p>
          <p className="text-[12px] font-medium text-gray-400">배송완료</p>
        </button>
      </div>

      {showBulk && (
        <div className="mb-6 rounded-2xl border border-gray-300 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-900">
          <BulkShippingUpload />
        </div>
      )}

      {/* 탭 */}
      <div className="mb-5 flex gap-2">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === 'payment_verified' ? pendingCount : tab.value === 'shipped' ? shippingCount : 0;
          return (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); resetForm(); setSelected(new Set()); }}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {count > 0 && (
                <span className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                  activeTab === tab.value
                    ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900'
                    : 'bg-pink-500 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 발송대기: 일괄 액션 바 */}
      {activeTab === 'payment_verified' && orders.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-gray-50 px-5 py-3 dark:bg-gray-900">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.size === orders.length && orders.length > 0}
              onChange={toggleAll}
              className="rounded"
            />
            <span className="text-gray-600 dark:text-gray-400">
              전체선택 ({selected.size}/{orders.length})
            </span>
          </label>
          {selected.size > 0 && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              선택 일괄발송 ({selected.size}건)
            </button>
          )}
        </div>
      )}

      {/* 목록 */}
      {isLoading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 80 }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Package className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {activeTab === 'payment_verified' ? '발송 대기중인 주문이 없습니다.' :
             activeTab === 'shipped' ? '배송중인 주문이 없습니다.' :
             '배송 완료된 주문이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
              <div className="p-5">
                <div className="flex items-start gap-3">
                  {activeTab === 'payment_verified' && (
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="mt-1 rounded"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/seller/orders/${order.id}`} className="text-sm font-bold text-gray-900 hover:text-pink-500 dark:text-white dark:hover:text-pink-400">
                        {order.order_number}
                      </Link>
                      <span className="text-[12px] text-gray-400">
                        {new Date(order.created_at).toLocaleString('ko')}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {order.first_item_title}
                      {order.item_count > 1 && <span className="text-gray-400"> 외 {order.item_count - 1}건</span>}
                    </p>

                    <div className="mt-1.5 flex items-center gap-3 text-[12px] text-gray-400">
                      <span>{order.buyer_nickname || '구매자'}</span>
                      <span className="text-gray-200 dark:text-gray-700">|</span>
                      <span>수령인: {order.recipient_name}</span>
                      <span>{order.recipient_phone}</span>
                      <button
                        onClick={() => toggleExpand(order.id)}
                        className="font-medium text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
                      >
                        {expandedOrders.has(order.id) ? '접기' : '주소보기'}
                      </button>
                    </div>

                    {expandedOrders.has(order.id) && (
                      <div className="mt-2 rounded-xl bg-gray-50 p-3 text-[12px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <p>수령인: {order.recipient_name} / {order.recipient_phone}</p>
                      </div>
                    )}
                  </div>

                  <div className="ml-2 flex shrink-0 items-center gap-3">
                    <p className="whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">₮ {order.total_amount}</p>

                    {activeTab === 'payment_verified' && shippingForm !== order.id && (
                      <button
                        onClick={() => { resetForm(); setShippingForm(order.id); }}
                        className="whitespace-nowrap rounded-full bg-gray-900 px-4 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                      >
                        송장입력
                      </button>
                    )}
                  </div>
                </div>

                {/* 배송중/완료: 운송장 정보 */}
                {(activeTab === 'shipped' || activeTab === 'delivered') && order.carrier_name && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-[12px] text-gray-400">택배사</span>
                        <p className="font-bold text-gray-900 dark:text-white">{order.carrier_name}</p>
                      </div>
                      <div>
                        <span className="text-[12px] text-gray-400">운송장</span>
                        <p className="font-mono font-bold text-gray-900 dark:text-white">{order.tracking_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[12px]">
                      {order.shipped_at && (
                        <span className="text-gray-400">발송 {new Date(order.shipped_at).toLocaleDateString('ko')}</span>
                      )}
                      {order.delivered_at && (
                        <span className="font-medium text-emerald-500">배달완료 {new Date(order.delivered_at).toLocaleDateString('ko')}</span>
                      )}
                      {order.auto_confirm_at && !order.confirmed_at && (
                        <span className="text-orange-500">자동확정 {new Date(order.auto_confirm_at).toLocaleDateString('ko')}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 개별 송장입력 폼 */}
              {shippingForm === order.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">배송정보 입력</h4>
                    <button onClick={resetForm} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* 배송 유형 선택 */}
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {([
                      { value: 'parcel' as const, label: '택배배송', icon: <Package className="h-5 w-5" />, desc: '택배사 + 운송장' },
                      { value: 'direct' as const, label: '직접배송', icon: <Car className="h-5 w-5" />, desc: '퀵, 화물, 방문수령' },
                      { value: 'digital' as const, label: '온라인배송', icon: <Monitor className="h-5 w-5" />, desc: '소프트웨어, 디지털' },
                    ]).map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setDeliveryType(type.value)}
                        className={`rounded-2xl p-4 text-left transition-all ${
                          deliveryType === type.value
                            ? 'bg-white ring-2 ring-gray-900 dark:bg-gray-900 dark:ring-white'
                            : 'bg-white hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span className={deliveryType === type.value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>{type.icon}</span>
                        <p className={`mt-2 text-sm font-bold ${deliveryType === type.value ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                          {type.label}
                        </p>
                        <p className="text-[12px] text-gray-400">{type.desc}</p>
                      </button>
                    ))}
                  </div>

                  {deliveryType === 'parcel' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">택배사 *</label>
                        <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
                          {PARCEL_CARRIERS.map((code) => (
                            <option key={code} value={code}>{CARRIERS[code]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">운송장 번호 *</label>
                        <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="운송장 번호를 입력하세요" className={inputClass} autoFocus />
                      </div>
                    </div>
                  )}

                  {deliveryType === 'direct' && (
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">배송 메모 (선택)</label>
                      <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="예: 퀵서비스 오후 3시 발송, 화물 접수번호" className={inputClass} />
                      <p className="mt-1.5 text-[12px] text-gray-400">직접배송은 운송장 없이 발송처리됩니다.</p>
                    </div>
                  )}

                  {deliveryType === 'digital' && (
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">발송 안내 (선택)</label>
                      <textarea value={digitalNote} onChange={(e) => setDigitalNote(e.target.value)} placeholder="예: 이메일로 라이선스 키 발송" rows={2} className={inputClass} />
                      <p className="mt-1.5 text-[12px] text-gray-400">디지털 상품은 발송 즉시 배송완료로 처리됩니다.</p>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={resetForm} className="rounded-full bg-gray-200 px-5 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">취소</button>
                    <button
                      onClick={() => shippingMutation.mutate(order.id)}
                      disabled={!canSubmitSingle || shippingMutation.isPending}
                      className="rounded-full bg-gray-900 px-6 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      {shippingMutation.isPending ? '처리중...' : '발송처리'}
                    </button>
                  </div>
                  {shippingMutation.isError && (
                    <p className="mt-2 text-center text-[13px] text-red-500">발송 처리에 실패했습니다.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 일괄 발송 모달 */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowBatchModal(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">일괄 발송처리 ({selected.size}건)</h3>
                <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">선택한 주문의 배송정보를 입력해주세요.</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-4 flex gap-2">
                {([
                  { value: 'parcel' as const, label: '택배배송' },
                  { value: 'direct' as const, label: '직접배송' },
                  { value: 'digital' as const, label: '온라인배송' },
                ]).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setBatchType(type.value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      batchType === type.value
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {batchType === 'parcel' && (
                <>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">택배사 (공통)</label>
                    <select value={batchCarrier} onChange={(e) => setBatchCarrier(e.target.value)} className={inputClass}>
                      {PARCEL_CARRIERS.map((code) => (
                        <option key={code} value={code}>{CARRIERS[code]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-[40vh] space-y-2 overflow-y-auto">
                    {orders.filter((o) => selected.has(o.id)).map((order) => (
                      <div key={order.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{order.order_number}</p>
                          <p className="truncate text-[12px] text-gray-400">{order.first_item_title} / {order.recipient_name}</p>
                        </div>
                        <input
                          value={batchTrackings[order.id] || ''}
                          onChange={(e) => setBatchTrackings((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="운송장 번호"
                          className="w-48 rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {batchType === 'direct' && (
                <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  선택한 {selected.size}건의 주문을 직접배송으로 일괄 처리합니다.
                </div>
              )}
              {batchType === 'digital' && (
                <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  선택한 {selected.size}건의 주문을 온라인배송(디지털)으로 일괄 처리합니다.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 p-5 dark:border-gray-700">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                {batchType === 'parcel'
                  ? `${batchFilledCount}/${selected.size}건 운송장 입력 완료`
                  : `${selected.size}건 발송 예정`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowBatchModal(false)} className="rounded-full bg-gray-100 px-5 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">취소</button>
                <button
                  onClick={() => batchMutation.mutate()}
                  disabled={batchMutation.isPending || (batchType === 'parcel' && batchFilledCount === 0)}
                  className="rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  {batchMutation.isPending ? '처리중...' : `일괄 발송처리 (${batchType === 'parcel' ? batchFilledCount : selected.size}건)`}
                </button>
              </div>
            </div>
            {batchMutation.isError && (
              <p className="px-5 pb-3 text-center text-[13px] text-red-500">일괄 발송 처리 중 오류가 발생했습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function resolveShipping(
  type: 'parcel' | 'direct' | 'digital',
  carrier: string,
  trackingNumber: string,
  digitalNote: string,
): { code: string; name: string; tracking: string } {
  if (type === 'digital') {
    return { code: 'digital', name: '온라인배송 (디지털)', tracking: digitalNote || '디지털 상품 발송완료' };
  }
  if (type === 'direct') {
    return { code: 'direct', name: '직접배송', tracking: trackingNumber || '직접배송' };
  }
  return { code: carrier, name: CARRIERS[carrier] || carrier, tracking: trackingNumber };
}
