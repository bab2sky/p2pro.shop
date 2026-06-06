import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Package, Ticket, Store, Zap, X } from 'lucide-react';
import { getCart, removeCartItem, type CartGroup, type CartItemDetail } from '@/lib/api/cart';
import { createOrder, getAvailablePaymentNetworks } from '@/lib/api/orders';
import { getProduct } from '@/lib/api/products';
import { getAddresses, type Address } from '@/lib/api/addresses';
import { AddressSelector } from '@/components/address/AddressSelector';
import { OnboardingModal } from '@/features/onboarding';
import { CouponSelector } from '@/features/coupons/CouponSelector';
import { useAuthStore } from '@/features/auth/store';

interface BuyNowItem {
  product_id: string;
  option_id?: string | null;
  quantity: number;
}

export default function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const buyNowItems = (location.state as { items?: BuyNowItem[] } | null)?.items;
  const isBuyNowMode = !!buyNowItems && buyNowItems.length > 0;

  const { data: cartGroups, isLoading: isCartLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: getCart,
    enabled: !isBuyNowMode,
  });
  const { data: addresses } = useQuery({ queryKey: ['addresses'], queryFn: getAddresses });
  const { data: availableNetworks } = useQuery({
    queryKey: ['payment-networks'],
    queryFn: getAvailablePaymentNetworks,
    staleTime: 60_000,
  });

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('onboarding_completed') !== 'true';
  });
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [paymentNetwork, setPaymentNetwork] = useState<string>('TRC-20');

  // 사용 가능한 네트워크가 로드되면 현재 선택이 비어있거나 사용 불가하면 첫 번째로 자동 전환
  useEffect(() => {
    if (!availableNetworks || availableNetworks.length === 0) return;
    if (!availableNetworks.includes(paymentNetwork)) {
      setPaymentNetwork(availableNetworks[0]);
    }
  }, [availableNetworks, paymentNetwork]);
  const [form, setForm] = useState({
    recipient_name: '',
    recipient_phone: '',
    zipcode: '',
    address1: '',
    address2: '',
    shipping_memo: '',
  });

  // 주문자 정보 (DB 사용자 정보, read-only)
  const ordererName = user?.nickname || '';
  const ordererPhone = user?.phone || '';

  const handleSelectAddress = useCallback((addr: Address) => {
    setSelectedAddressId(addr.id);
    setForm({
      recipient_name: addr.recipient_name,
      recipient_phone: addr.recipient_phone,
      zipcode: addr.zipcode,
      address1: addr.address1,
      address2: addr.address2 || '',
      shipping_memo: '',
    });
  }, []);

  useEffect(() => {
    if (!selectedAddressId && addresses && addresses.length > 0) {
      const def = addresses.find((a) => a.is_default) || addresses[0];
      handleSelectAddress(def);
    }
  }, [addresses, selectedAddressId, handleSelectAddress]);

  // 비-디지털 주문에서 저장된 배송지 없을 때 수령인 정보 미리 채우기 (수정 가능, 다른 사람 입력 OK)
  useEffect(() => {
    if (selectedAddressId || !user) return;
    setForm((prev) => ({
      ...prev,
      recipient_name: prev.recipient_name || user.nickname || '',
      recipient_phone: prev.recipient_phone || user.phone || '',
    }));
  }, [user, selectedAddressId]);

  // Buy Now 모드: location state 의 items 로 부터 product 정보 조회
  const buyNowProductQueries = useQueries({
    queries: (buyNowItems || []).map((it) => ({
      queryKey: ['product', it.product_id],
      queryFn: () => getProduct(it.product_id),
      staleTime: 5 * 60_000,
      enabled: isBuyNowMode,
    })),
  });

  const isBuyNowReady =
    isBuyNowMode &&
    buyNowProductQueries.length > 0 &&
    buyNowProductQueries.every((q) => !q.isLoading && !!q.data);

  // Buy Now items → CartGroup[] 형태로 재구성 (판매자별 그룹)
  const buyNowGroups: CartGroup[] = useMemo(() => {
    if (!isBuyNowReady) return [];
    const bySeller = new Map<string, CartGroup>();
    buyNowItems!.forEach((bi, idx) => {
      const product = buyNowProductQueries[idx].data!;
      const opt = product.options.find((o) => o.id === bi.option_id);
      const unitPrice = Number(product.final_price) + (opt ? Number(opt.additional_price) : 0);
      const subtotal = unitPrice * bi.quantity;
      const item: CartItemDetail = {
        id: `buynow-${bi.product_id}-${bi.option_id ?? 'none'}`,
        product_id: bi.product_id,
        product_title: product.title,
        product_image: product.images?.find((i) => i.is_main)?.image_url ?? product.images?.[0]?.image_url ?? null,
        option_id: bi.option_id ?? null,
        option_label: opt ? `${opt.option_name}: ${opt.option_value}` : null,
        unit_price: String(unitPrice),
        quantity: bi.quantity,
        subtotal: String(subtotal),
        stock: opt?.stock ?? product.stock,
        category_name: product.category?.name ?? null,
      };
      const existing = bySeller.get(product.seller_id);
      if (existing) {
        existing.items.push(item);
        existing.subtotal = String(Number(existing.subtotal) + subtotal);
      } else {
        bySeller.set(product.seller_id, {
          seller_id: product.seller_id,
          seller_name: product.seller_name,
          items: [item],
          subtotal: String(subtotal),
          shipping_fee: String(product.shipping_fee || 0),
        });
      }
    });
    return [...bySeller.values()];
  }, [isBuyNowReady, buyNowItems, buyNowProductQueries]);

  const groups: CartGroup[] | undefined = isBuyNowMode ? buyNowGroups : cartGroups;
  const isLoading = isBuyNowMode ? !isBuyNowReady : isCartLoading;

  // 카트 내 고유 product_id 목록 (디지털 여부 판단용 — 카트 모드만)
  const productIds = (cartGroups || []).flatMap((g: CartGroup) => g.items.map((i) => i.product_id));
  const uniqueProductIds = [...new Set(productIds)];

  // 상품 카테고리 조회 (캐시 우선, staleTime 5분)
  const productQueries = useQueries({
    queries: uniqueProductIds.map((id) => ({
      queryKey: ['product', id],
      queryFn: () => getProduct(id),
      staleTime: 5 * 60_000,
      enabled: !isBuyNowMode && uniqueProductIds.length > 0,
    })),
  });

  // 디지털 전용 여부: BuyNow면 buyNow product 들로, 카트면 카트 product 들로 판단
  const digitalSourceQueries = isBuyNowMode ? buyNowProductQueries : productQueries;
  const digitalQueriesDone =
    digitalSourceQueries.length > 0 && digitalSourceQueries.every((q) => !q.isLoading);
  const isDigitalOnly =
    digitalQueriesDone && digitalSourceQueries.every((q) => q.data?.category?.is_digital === true);

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeCartItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    if (!ordererName.trim() || !ordererPhone.trim()) {
      setValidationError('주문자 정보(닉네임/연락처)가 등록되어 있지 않습니다. 프로필에서 먼저 등록해주세요.');
      return false;
    }
    if (!isDigitalOnly) {
      if (!form.recipient_name.trim()) {
        setValidationError('수령인 이름을 입력해주세요.');
        return false;
      }
      if (!form.recipient_phone.trim()) {
        setValidationError('수령인 연락처를 입력해주세요.');
        return false;
      }
      if (!form.zipcode.trim()) {
        setValidationError('우편번호를 입력해주세요.');
        return false;
      }
      if (!form.address1.trim()) {
        setValidationError('주소를 입력해주세요.');
        return false;
      }
    }
    const items = (groups || []).flatMap((g: CartGroup) => g.items);
    if (items.length === 0) {
      setValidationError('주문할 상품이 없습니다.');
      return false;
    }
    const invalidQty = items.find((i) => !i.quantity || i.quantity < 1);
    if (invalidQty) {
      setValidationError('수량이 올바르지 않은 상품이 있습니다.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const orderMutation = useMutation({
    mutationFn: () => {
      const items = (groups || []).flatMap((g: CartGroup) =>
        g.items.map((i) => ({
          product_id: i.product_id,
          option_id: i.option_id || undefined,
          quantity: i.quantity,
          expected_price: i.unit_price,
        })),
      );
      const shippingForm = isDigitalOnly
        ? {
            ...form,
            // 디지털 상품: 수령인 정보를 주문자 정보로 자동 채움 (배송 없음)
            recipient_name: ordererName,
            recipient_phone: ordererPhone,
            zipcode: '00000',
            address1: '디지털 배송',
            address2: '',
            shipping_memo: '',
          }
        : form;
      return createOrder({
        items,
        coupon_id: selectedCouponId,
        payment_network: paymentNetwork,
        orderer_name: ordererName,
        orderer_phone: ordererPhone,
        ...shippingForm,
      });
    },
    onSuccess: (data) => {
      const orders = data?.data?.orders;
      if (orders?.[0]) {
        navigate(`/payment/${orders[0].id}`);
      }
    },
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-7xl space-y-4 py-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 100 }} />
        ))}
      </div>
    );

  // Use integer arithmetic (cents) to avoid floating-point rounding errors
  const grandTotalCents = (groups || []).reduce(
    (sum: number, g: CartGroup) =>
      sum + Math.round(Number(g.subtotal) * 100) + Math.round(Number(g.shipping_fee) * 100),
    0,
  );
  const couponDiscountCents = Math.round(couponDiscount * 100);
  const finalTotalCents = grandTotalCents - couponDiscountCents;
  const grandTotal = grandTotalCents / 100;
  const finalTotal = finalTotalCents / 100;

  const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div className="mx-auto max-w-7xl py-6" role="main" aria-label={t('checkout.title', '주문서 작성')}>
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">{t('checkout.title', '주문서 작성')}</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Order form */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Saved addresses — 실물 배송 상품일 때만 표시 */}
          {!isDigitalOnly && addresses && addresses.length > 0 && (
            <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('checkout.savedAddresses', '저장된 배송지')}</h2>
              </div>
              <AddressSelector
                addresses={addresses}
                selectedId={selectedAddressId}
                onSelect={handleSelectAddress}
              />
            </div>
          )}

          {/* Orderer info (read-only, from profile) */}
          <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              {isDigitalOnly ? (
                <Zap className="h-4 w-4 text-purple-400" />
              ) : (
                <MapPin className="h-4 w-4 text-gray-400" />
              )}
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('checkout.ordererInfo', '주문자 정보')}</h2>
              {isDigitalOnly && (
                <span className="ml-auto rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  {t('checkout.digitalOnlyBadge', '디지털 상품 — 실물 배송 없음')}
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="checkout-orderer" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.ordererName', '주문자')}</label>
                <input
                  id="checkout-orderer"
                  value={ordererName}
                  readOnly
                  className={`${inputClass} cursor-not-allowed bg-gray-50 dark:bg-gray-800/60`}
                />
              </div>
              <div>
                <label htmlFor="checkout-orderer-phone" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.ordererPhone', '주문자 연락처')}</label>
                <input
                  id="checkout-orderer-phone"
                  value={ordererPhone}
                  readOnly
                  placeholder={t('checkout.ordererPlaceholder', '프로필에서 연락처를 등록해주세요')}
                  className={`${inputClass} cursor-not-allowed bg-gray-50 dark:bg-gray-800/60`}
                />
              </div>
              {(!ordererName.trim() || !ordererPhone.trim()) && (
                <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">
                  {t('checkout.ordererWarning', '⚠ 프로필에 닉네임 또는 연락처가 등록되어 있지 않습니다. 마이페이지에서 먼저 등록해주세요.')}
                </p>
              )}
            </div>
          </div>

          {/* Shipping info — non-digital only */}
          {!isDigitalOnly && (
            <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('checkout.recipientInfo', '수령인 정보')}</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="checkout-recipient" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.recipientName', '수령인')}</label>
                  <input
                    id="checkout-recipient"
                    value={form.recipient_name}
                    onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="checkout-phone" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.recipientPhone', '수령인 연락처')}</label>
                  <input
                    id="checkout-phone"
                    value={form.recipient_phone}
                    onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <div className="w-1/3">
                    <label htmlFor="checkout-zipcode" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.zipcode', '우편번호')}</label>
                    <input
                      id="checkout-zipcode"
                      value={form.zipcode}
                      onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="checkout-address1" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.address1', '주소')}</label>
                    <input
                      id="checkout-address1"
                      value={form.address1}
                      onChange={(e) => setForm({ ...form, address1: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="checkout-address2" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.address2', '상세주소')}</label>
                  <input
                    id="checkout-address2"
                    value={form.address2}
                    onChange={(e) => setForm({ ...form, address2: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="checkout-memo" className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('checkout.shippingMemo', '배송 메모')}</label>
                  <input
                    id="checkout-memo"
                    value={form.shipping_memo}
                    onChange={(e) => setForm({ ...form, shipping_memo: e.target.value })}
                    placeholder={t('checkout.memoPlaceholder', '부재 시 문 앞에 놓아주세요')}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Order items summary */}
          <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('checkout.orderItems', '주문 상품')}</h2>
            </div>
            <div className="space-y-4">
              {(groups || []).map((g: CartGroup) => (
                <div key={g.seller_id}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{g.seller_name}</span>
                  </div>
                  <div className="space-y-1.5">
                    {g.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
                        <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-700 dark:text-gray-300">
                          {item.product_title}
                          {item.option_label && <span className="ml-1 text-gray-400">({item.option_label})</span>}
                          <span className="ml-1 text-gray-400">x {item.quantity}</span>
                        </span>
                        <span className="shrink-0 text-base font-bold text-gray-900 dark:text-white">₮ {item.subtotal}</span>
                        {!isBuyNowMode && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t('checkout.removeItemConfirm', '이 상품을 주문에서 제외하시겠습니까?'))) {
                                removeMutation.mutate(item.id);
                              }
                            }}
                            disabled={removeMutation.isPending}
                            className="shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20"
                            aria-label={t('checkout.removeItemAria', '상품 삭제')}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coupon */}
          <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('checkout.couponDiscount', '쿠폰 할인')}</h2>
            </div>
            <CouponSelector
              orderTotal={grandTotal}
              onSelect={(couponId, discount) => {
                setSelectedCouponId(couponId);
                setCouponDiscount(discount);
              }}
            />
          </div>
        </div>

        {/* Right: Payment sidebar */}
        <div className="w-full lg:w-80">
          <div className="sticky top-20 space-y-4">
            {/* Summary */}
            <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
              <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">{t('checkout.summary', '결제 요약')}</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('checkout.itemTotal', '상품 금액')}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">₮ {grandTotal.toFixed(2)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-500">{t('checkout.couponDiscount', '쿠폰 할인')}</span>
                    <span className="font-semibold text-emerald-500">-₮ {couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-900 dark:text-white">{t('checkout.grandTotal', '총 결제금액')}</span>
                  <span className="text-xl font-bold text-pink-500">
                    ₮ {finalTotal.toFixed(2)}
                    <span className="ml-1 text-sm font-medium text-gray-400">USDT</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Network */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-3 text-[14px] font-bold text-gray-900 dark:text-white">{t('checkout.paymentNetwork', '결제 네트워크')}</h3>
              <div className="flex gap-2">
                {['TRC-20', 'ERC-20', 'BEP-20'].map((net) => {
                  const enabled = !availableNetworks || availableNetworks.includes(net);
                  const selected = paymentNetwork === net && enabled;
                  return (
                    <button
                      key={net}
                      type="button"
                      disabled={!enabled}
                      title={enabled ? net : t('checkout.networkNotConfigured', { network: net, defaultValue: '{{network}} (지갑 미설정)' })}
                      onClick={() => enabled && setPaymentNetwork(net)}
                      className={`flex-1 rounded-xl py-2.5 text-center text-[13px] font-bold transition-all ${
                        selected
                          ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                          : enabled
                            ? 'border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                            : 'cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {net}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                {paymentNetwork === 'TRC-20' && t('checkout.networkDescTrc20', 'TRON 네트워크 (낮은 수수료, 빠른 처리)')}
                {paymentNetwork === 'ERC-20' && t('checkout.networkDescErc20', 'Ethereum 네트워크 (높은 보안성)')}
                {paymentNetwork === 'BEP-20' && t('checkout.networkDescBep20', 'BNB Smart Chain (낮은 수수료)')}
              </p>
              {availableNetworks !== undefined && availableNetworks.length === 0 && (
                <p className="mt-2 text-[11px] font-bold text-red-500">
                  {t('checkout.noNetworkConfigured', '결제 네트워크가 설정되지 않았습니다. 관리자에게 문의해주세요.')}
                </p>
              )}
            </div>

            {/* CTA — 중복 클릭 방어: orderMutation.isPending 으로 disable + 핸들러도
                idempotent (이미 진행 중이면 무시). */}
            <button
              onClick={() => {
                if (orderMutation.isPending) return;
                if (validateForm()) {
                  orderMutation.mutate();
                }
              }}
              disabled={
                orderMutation.isPending ||
                !ordererName.trim() ||
                !ordererPhone.trim() ||
                (!isDigitalOnly && (!form.recipient_name.trim() || !form.recipient_phone.trim() || !form.address1.trim()))
              }
              className="w-full rounded-full bg-gray-900 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {orderMutation.isPending ? t('checkout.submitting', '주문 생성중...') : t('checkout.submit', '결제하기')}
            </button>
            {validationError && (
              <p className="text-center text-[13px] text-red-500" role="alert">{validationError}</p>
            )}
            {orderMutation.isError && (
              <p className="text-center text-[13px] text-red-500">
                {(orderMutation.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || t('checkout.submitFail', '주문 생성에 실패했습니다. 다시 시도해주세요.')}
              </p>
            )}
          </div>
        </div>
      </div>

      {showOnboarding && (
        <OnboardingModal
          onClose={() => {
            setShowOnboarding(false);
            localStorage.setItem('onboarding_completed', 'true');
          }}
        />
      )}
    </div>
  );
}
