import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileText,
  Package,
  MapPin,
  CreditCard,
  MessageCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { getOrder } from '@/lib/api/orders';
import { createChatRoom } from '@/lib/api/chat';
import { OrderTimeline } from '@/components/order/OrderTimeline';
import { InvoiceDownload } from '@/components/order/InvoiceDownload';
import { DeliveryTimeline } from '@/features/delivery/DeliveryTimeline';

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const chatMutation = useMutation({
    mutationFn: (orderId: string) => createChatRoom(orderId),
    onSuccess: (data) => navigate(`/chat/${data.data.id}`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center py-16">
        <Package className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-bold text-gray-400">{t('mypage.orderNotFound', '주문을 찾을 수 없습니다.')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6" role="main" aria-label={t('mypage.ariaOrderDetail', '주문 상세')}>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('mypage.ariaOrderDetail', '주문 상세')}</h1>

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

      {/* Delivery Tracking Timeline */}
      {(order.status === 'shipped' || order.status === 'delivered') && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
          <DeliveryTimeline orderId={order.id} />
        </div>
      )}

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
      <div className="flex gap-3">
        <InvoiceDownload order={order} />
        {order.id && (
          <button
            onClick={() => chatMutation.mutate(order.id)}
            disabled={chatMutation.isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-gray-300 py-3 text-[13px] font-bold text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
          >
            <MessageCircle className="h-4 w-4" />
            판매자와 채팅
          </button>
        )}
        {order.status === 'pending_payment' && (
          <button
            onClick={() => navigate(`/payment/${order.id}`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gray-900 py-3 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <CreditCard className="h-4 w-4" />
            결제하기
          </button>
        )}
        {(order.status === 'payment_verified' || order.status === 'shipped' || order.status === 'delivered') && (
          <button
            onClick={() => navigate(`/orders/${order.id}/refund`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-amber-500 py-3 text-[13px] font-bold text-amber-500 transition-colors hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            <RotateCcw className="h-4 w-4" />
            환불 요청
          </button>
        )}
        {(order.status === 'shipped' || order.status === 'delivered') && (
          <button
            onClick={() => navigate('/disputes', { state: { orderId: order.id } })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-red-500 py-3 text-[13px] font-bold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <AlertTriangle className="h-4 w-4" />
            분쟁 신청
          </button>
        )}
      </div>
    </div>
  );
}
