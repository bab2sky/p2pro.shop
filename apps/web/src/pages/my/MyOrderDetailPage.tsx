import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Package,
  MapPin,
  CreditCard,
  MessageCircle,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Truck,
  ArrowRightLeft,
  HelpCircle,
  Star,
  X,
  ExternalLink,
} from 'lucide-react';
import { getOrder, getDeliveryTracking } from '@/lib/api/orders';
import { confirmOrder, cancelOrder } from '@/lib/api/mypage';
import { OrderTimeline } from '@/components/order/OrderTimeline';
import { DeliveryTimeline } from '@/features/delivery/DeliveryTimeline';
import { extractApiError } from '@/lib/api-error';

export default function MyOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const { data: tracking } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => getDeliveryTracking(id!),
    enabled: !!id && (order?.status === 'shipped' || order?.status === 'delivered'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrder(id!),
    onSuccess: () => {
      setShowConfirmModal(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id!),
    onSuccess: () => {
      setShowCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center py-16">
        <Package className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-bold text-gray-400">주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">주문 상세</h1>

      {/* Delivery tracking banner */}
      {tracking && (order.status === 'shipped' || order.status === 'delivered') && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-5 py-3.5 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2 text-[13px]">
            <Truck className="h-4 w-4 text-emerald-500" />
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {order.status === 'shipped' ? '배송중' : '배송완료'}
            </span>
            <span className="text-emerald-600/70 dark:text-emerald-400/70">
              {tracking.carrier_name} | 송장: {tracking.tracking_number}
            </span>
          </div>
          {tracking.tracking_number && (
            <a
              href={`https://trace.cjlogistics.com/web/detail.jsp?slipno=${tracking.tracking_number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] font-bold text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400"
            >
              배송 추적
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Delivery Tracking Timeline */}
      {(order.status === 'shipped' || order.status === 'delivered') && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
          <DeliveryTimeline orderId={order.id} />
        </div>
      )}

      {/* Timeline */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
        <OrderTimeline events={order.timeline} />
      </div>

      {/* Order info */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <FileText className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">주문 정보</h2>
        </div>
        <dl className="space-y-2.5 p-5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-gray-400">주문번호</dt>
            <dd className="font-mono text-gray-900 dark:text-white">{order.order_number}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">판매자</dt>
            <dd className="font-bold text-gray-900 dark:text-white">{order.seller_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">주문일시</dt>
            <dd className="text-gray-900 dark:text-white">{order.created_at && new Date(order.created_at).toLocaleString('ko')}</dd>
          </div>
          {order.txid && (
            <div className="flex justify-between">
              <dt className="text-gray-400">TXID</dt>
              <dd className="max-w-[250px] break-all rounded-xl bg-gray-100 px-3 py-1.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">{order.txid}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Items */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <Package className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">주문 상품</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-5">
              <div>
                <p className="text-[14px] font-bold text-gray-900 dark:text-white">{item.product_title}</p>
                {item.option_label && <p className="mt-0.5 text-[12px] text-gray-400">{item.option_label}</p>}
                <p className="mt-0.5 text-[12px] text-gray-400">{item.unit_price} USDT x {item.quantity}</p>
              </div>
              <p className="text-[14px] font-bold text-pink-500">{item.subtotal} USDT</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <MapPin className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">배송 정보</h2>
        </div>
        <dl className="space-y-2 p-5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-gray-400">수령인</dt>
            <dd className="font-bold text-gray-900 dark:text-white">{order.recipient_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">연락처</dt>
            <dd className="text-gray-900 dark:text-white">{order.recipient_phone}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">주소</dt>
            <dd className="text-right text-gray-900 dark:text-white">{order.address1} {order.address2}</dd>
          </div>
          {order.shipping_memo && (
            <div className="flex justify-between">
              <dt className="text-gray-400">메모</dt>
              <dd className="text-gray-900 dark:text-white">{order.shipping_memo}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Amount */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">결제 금액</h2>
        </div>
        <dl className="space-y-2.5 p-5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-gray-400">상품금액</dt>
            <dd className="text-gray-900 dark:text-white">{order.subtotal} USDT</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">배송비</dt>
            <dd className="text-gray-900 dark:text-white">{order.shipping_fee} USDT</dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2.5 dark:border-gray-800">
            <dt className="text-[15px] font-bold text-gray-900 dark:text-white">총 결제금액</dt>
            <dd className="text-[15px] font-bold text-pink-500">{order.total_amount} USDT</dd>
          </div>
        </dl>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {order.status === 'pending_payment' && (
          <>
            <button
              onClick={() => navigate(`/payment/${order.id}`)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gray-900 py-3 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <CreditCard className="h-4 w-4" />
              결제하기
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-full border-2 border-red-500 px-6 py-3 text-[13px] font-bold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <X className="h-4 w-4" />
              주문 취소
            </button>
          </>
        )}

        {order.status === 'delivered' && (
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-500 py-3 text-[13px] font-bold text-white transition-colors hover:bg-emerald-600"
          >
            <CheckCircle className="h-4 w-4" />
            구매 확정
          </button>
        )}

        {order.status === 'confirmed' && (
          <button
            onClick={() => navigate(`/products/${order.items[0]?.product_id}#review`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-gray-900 py-3 text-[13px] font-bold text-gray-900 transition-colors hover:bg-gray-50 dark:border-white dark:text-white dark:hover:bg-gray-800"
          >
            <Star className="h-4 w-4" />
            리뷰 작성
          </button>
        )}

        {order.items[0]?.product_id && (
          <button
            onClick={() => navigate(`/products/${order.items[0].product_id}#qna`)}
            className="flex items-center justify-center gap-1.5 rounded-full border-2 border-gray-300 px-5 py-3 text-[13px] font-bold text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
          >
            <MessageCircle className="h-4 w-4" />
            판매자에게 문의하기
          </button>
        )}

        {(order.status === 'payment_verified' || order.status === 'shipped' || order.status === 'delivered') && (
          <>
            <button
              onClick={() => navigate(`/orders/${order.id}/refund`)}
              className="flex items-center justify-center gap-1.5 rounded-full border-2 border-amber-500 px-5 py-3 text-[13px] font-bold text-amber-500 transition-colors hover:bg-amber-50 dark:hover:bg-amber-500/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              환불
            </button>
            {(order.status === 'shipped' || order.status === 'delivered') && (
              <button
                onClick={() => navigate(`/orders/${order.id}/exchange`)}
                className="flex items-center justify-center gap-1.5 rounded-full border-2 border-gray-300 px-5 py-3 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                교환
              </button>
            )}
            <button
              onClick={() => navigate(`/orders/${order.id}/inquiry`)}
              className="flex items-center justify-center gap-1.5 rounded-full border-2 border-gray-300 px-5 py-3 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              1:1 문의
            </button>
            <button
              onClick={() => navigate('/disputes', { state: { orderId: order.id } })}
              className="flex items-center justify-center gap-1.5 rounded-full border-2 border-red-500 px-5 py-3 text-[13px] font-bold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              분쟁
            </button>
          </>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">구매 확정</h3>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
              구매를 확정하시겠습니까? 확정 후에는 환불이 제한될 수 있습니다.
            </p>
            {confirmMutation.isError && (
              <p className="mt-2 text-[13px] text-red-500">{extractApiError(confirmMutation.error)}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="flex-1 rounded-full bg-emerald-500 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {confirmMutation.isPending ? '처리 중...' : '확정'}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-full bg-gray-100 py-2.5 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">주문 취소</h3>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
              주문을 취소하시겠습니까? 취소 후 재고가 복원됩니다.
            </p>
            {cancelMutation.isError && (
              <p className="mt-2 text-[13px] text-red-500">{extractApiError(cancelMutation.error)}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {cancelMutation.isPending ? '처리 중...' : '주문 취소'}
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-full bg-gray-100 py-2.5 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
