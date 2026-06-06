import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Package,
  CreditCard,
  MapPin,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  X,
  User,
  Shield,
} from 'lucide-react';
import { getOrder, registerShipping, getDeliveryTracking, completeDigitalDelivery } from '@/lib/api/orders';
import { OrderTimeline } from '@/components/order/OrderTimeline';

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

const CARRIERS: Record<string, string> = {
  cj: 'CJ대한통운',
  hanjin: '한진택배',
  lotte: '롯데택배',
  logen: '로젠택배',
  post: '우체국택배',
  epost: 'EMS',
  kdexp: '경동택배',
};

const STATUS_MAP: Record<string, { label: string; icon: typeof Clock; style: string }> = {
  pending_payment: { label: '결제대기', icon: Clock, style: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  txid_submitted: { label: 'TXID 제출', icon: Shield, style: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  verifying: { label: 'TXID 검증중', icon: Shield, style: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  payment_verified: { label: '결제확인 (발송대기)', icon: CheckCircle, style: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  payment_rejected: { label: '결제거부', icon: XCircle, style: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  paid: { label: '결제완료', icon: CheckCircle, style: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  shipped: { label: '배송중', icon: Truck, style: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  delivered: { label: '배송완료', icon: Package, style: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  confirmed: { label: '구매확정', icon: CheckCircle, style: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  cancelled: { label: '취소', icon: XCircle, style: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  refunded: { label: '환불', icon: XCircle, style: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  disputed: { label: '분쟁중', icon: AlertTriangle, style: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
};

export default function SellerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showShipping, setShowShipping] = useState(false);
  const [carrier, setCarrier] = useState('cj');
  const [trackingNumber, setTrackingNumber] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const { data: delivery } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => getDeliveryTracking(id!),
    enabled: !!id && !!order && ['shipped', 'delivered', 'confirmed'].includes(order.status),
  });

  const shippingMutation = useMutation({
    mutationFn: () =>
      registerShipping(id!, {
        carrier_code: carrier,
        carrier_name: CARRIERS[carrier] || carrier,
        tracking_number: trackingNumber,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['delivery', id] });
      queryClient.invalidateQueries({ queryKey: ['sellerOrders'] });
      queryClient.invalidateQueries({ queryKey: ['sellerDashboardStats'] });
      setShowShipping(false);
      setTrackingNumber('');
    },
  });

  // v1.3.6: 디지털 상품 즉시 전송완료 (운송장 없이 payment_verified → delivered)
  const digitalDeliveryMutation = useMutation({
    mutationFn: () => completeDigitalDelivery(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['sellerOrders'] });
      queryClient.invalidateQueries({ queryKey: ['sellerDashboardStats'] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 120 }} />
        ))}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center py-16">
        <Package className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const st = STATUS_MAP[order.status] ?? { label: order.status, icon: Clock, style: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
  const StatusIcon = st.icon;
  const canShip = order.status === 'payment_verified';

  return (
    <div className="max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">주문 상세</h1>
        </div>
        <Link to="/seller/orders" className="rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
          주문 목록
        </Link>
      </div>

      {/* Status Banner */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold ${st.style}`}>
              <StatusIcon className="h-4 w-4" />
              {st.label}
            </span>
            <p className="mt-2 font-mono text-[12px] text-gray-400">주문번호: {order.order_number}</p>
            <p className="mt-0.5 text-[12px] text-gray-400">
              주문일시: {order.created_at && new Date(order.created_at).toLocaleString('ko')}
            </p>
          </div>
          {canShip && order.is_digital && (
            <button
              onClick={() => {
                if (window.confirm('디지털 상품 전송이 완료되었습니까? 구매자에게 즉시 배송완료로 처리됩니다.')) {
                  digitalDeliveryMutation.mutate();
                }
              }}
              disabled={digitalDeliveryMutation.isPending}
              className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              title="디지털 상품(NFT/소프트웨어)은 운송장이 필요 없습니다"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {digitalDeliveryMutation.isPending ? '처리중...' : '디지털 전송 완료'}
            </button>
          )}
          {canShip && !order.is_digital && (
            <button
              onClick={() => setShowShipping(true)}
              className="flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Truck className="h-3.5 w-3.5" />
              발송처리
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {order.timeline && order.timeline.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
          <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-white">주문 진행 상태</h2>
          <OrderTimeline events={order.timeline} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Payment Info */}
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <CreditCard className="h-4 w-4" />
              결제정보
              {order.txid && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-500 dark:bg-emerald-500/10">TXID 제출됨</span>
              )}
            </h2>
          </div>
          <div className="p-5">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">상품금액</dt>
                <dd className="font-medium text-gray-900 dark:text-white">₮ {order.subtotal}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">배송비</dt>
                <dd className="font-medium text-gray-900 dark:text-white">₮ {order.shipping_fee}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">마진금액</dt>
                <dd className="font-medium text-gray-900 dark:text-white">₮ {order.margin_amount}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2.5 dark:border-gray-800">
                <dt className="font-bold text-gray-900 dark:text-white">총 결제금액</dt>
                <dd className="text-base font-bold text-pink-500">₮ {order.total_amount}</dd>
              </div>
            </dl>

            {order.txid ? (
              <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <p className="mb-1.5 text-[11px] font-bold text-gray-400">TXID (Transaction Hash)</p>
                <p className="select-all break-all rounded-xl bg-white p-3 font-mono text-[12px] text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                  {order.txid}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400">구매자가 아직 TXID를 제출하지 않았습니다.</p>
                {order.txid_deadline && (
                  <p className="mt-1 text-[12px] text-amber-500">
                    제출 기한: {new Date(order.txid_deadline).toLocaleString('ko')}
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 text-[11px] text-gray-400">
              에스크로 지갑: <span className="font-mono">{order.company_wallet}</span>
            </p>
          </div>
        </div>

        {/* Shipping Info */}
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <MapPin className="h-4 w-4" />
              배송정보
            </h2>
          </div>
          <div className="p-5">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">수령인</dt>
                <dd className="font-bold text-gray-900 dark:text-white">{order.recipient_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">연락처</dt>
                <dd className="text-gray-900 dark:text-white">{order.recipient_phone}</dd>
              </div>
              <div>
                <dt className="mb-0.5 text-gray-400">배송주소</dt>
                <dd className="text-gray-900 dark:text-white">
                  [{order.zipcode}] {order.address1}
                  {order.address2 && ` ${order.address2}`}
                </dd>
              </div>
              {order.shipping_memo && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">배송메모</dt>
                  <dd className="text-gray-600 dark:text-gray-400">{order.shipping_memo}</dd>
                </div>
              )}
            </dl>

            {delivery && (
              <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-gray-900 dark:text-white">
                  <Truck className="h-3.5 w-3.5" />
                  배송 추적
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">택배사</dt>
                    <dd className="text-gray-900 dark:text-white">{delivery.carrier_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">운송장</dt>
                    <dd className="font-mono text-gray-900 dark:text-white">{delivery.tracking_number}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">상태</dt>
                    <dd className="font-bold text-gray-900 dark:text-white">
                      {delivery.status === 'in_transit' ? '배송중' : delivery.status === 'delivered' ? '배달완료' : delivery.status === 'out_for_delivery' ? '배달출발' : delivery.status}
                    </dd>
                  </div>
                  {delivery.last_detail && (
                    <div>
                      <dt className="text-gray-400">최근 상태</dt>
                      <dd className="mt-0.5 text-[12px] text-gray-600 dark:text-gray-400">{delivery.last_detail}</dd>
                    </div>
                  )}
                  {delivery.delivered_at && (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">배달완료일</dt>
                      <dd className="font-bold text-emerald-500">{new Date(delivery.delivered_at).toLocaleString('ko')}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {canShip && !delivery && (
              <div className="mt-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                <p className="mb-2 text-[13px] font-medium text-amber-600 dark:text-amber-400">결제가 확인되었습니다. 상품을 발송해주세요.</p>
                <button
                  onClick={() => setShowShipping(true)}
                  className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  <Truck className="h-3 w-3" />
                  발송처리
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Package className="h-4 w-4" />
            주문 상품 ({order.items.length}건)
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-4">
              {item.product_image ? (
                <img src={item.product_image} alt={item.product_title} className="h-14 w-14 shrink-0 rounded-xl border border-gray-200 object-cover dark:border-gray-700" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.product_id}`} className="text-sm font-bold text-gray-900 hover:text-pink-500 dark:text-white dark:hover:text-pink-400">
                  {item.product_title}
                </Link>
                {item.option_label && <p className="mt-0.5 text-[12px] text-gray-400">{item.option_label}</p>}
                <p className="mt-0.5 text-[12px] text-gray-400">
                  ₮ {item.unit_price} × {item.quantity}개
                </p>
              </div>
              <p className="shrink-0 font-bold text-pink-500">₮ {item.subtotal}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Buyer Info */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <User className="h-4 w-4" />
            구매자 정보
          </h2>
        </div>
        <div className="p-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">구매자 ID</span>
            <span className="font-mono text-[12px] text-gray-500">{order.buyer_id}</span>
          </div>
        </div>
      </div>

      {/* Shipping Modal */}
      {showShipping && canShip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShipping(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                <Truck className="h-4 w-4" />
                배송 등록
              </h2>
              <button onClick={() => setShowShipping(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">택배사</label>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
                  {Object.entries(CARRIERS).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">운송장 번호</label>
                <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="운송장 번호를 입력하세요" className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowShipping(false)} className="flex-1 rounded-full bg-gray-100 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
                  취소
                </button>
                <button
                  onClick={() => shippingMutation.mutate()}
                  disabled={!trackingNumber.trim() || shippingMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gray-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  <Truck className="h-3.5 w-3.5" />
                  {shippingMutation.isPending ? '처리중...' : '발송처리'}
                </button>
              </div>
              {shippingMutation.isError && (
                <p className="text-center text-[13px] text-red-500">배송 등록에 실패했습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
