import { useState } from 'react';
import { useCoupons, type UserCoupon } from './useCoupons';

interface CouponSelectorProps {
  orderTotal: number;
  onSelect: (couponId: string | null, discountAmount: number) => void;
}

export function CouponSelector({ orderTotal, onSelect }: CouponSelectorProps) {
  const { data: coupons, isLoading } = useCoupons('available');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) return <div className="text-sm text-gray-500">쿠폰 로딩중...</div>;
  if (!coupons?.length) return null;

  const eligible = coupons.filter((c: UserCoupon) => {
    const min = c.coupon.min_order_amount || 0;
    return orderTotal >= min;
  });

  if (!eligible.length) return null;

  const handleSelect = (couponId: string) => {
    if (selectedId === couponId) {
      setSelectedId(null);
      onSelect(null, 0);
      return;
    }

    const coupon = eligible.find((c: UserCoupon) => c.id === couponId)?.coupon;
    if (!coupon) return;

    let discount = 0;
    if (coupon.discount_type === 'fixed') {
      discount = coupon.discount_value;
    } else if (coupon.discount_type === 'percent') {
      discount = orderTotal * (coupon.discount_value / 100);
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    }
    discount = Math.min(discount, orderTotal);

    setSelectedId(couponId);
    onSelect(couponId, discount);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">사용 가능한 쿠폰</h3>
      {eligible.map((c: UserCoupon) => (
        <button
          key={c.id}
          onClick={() => handleSelect(c.id)}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            selectedId === c.id
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-sm">{c.coupon.name}</p>
              <p className="text-xs text-gray-500">
                {c.coupon.discount_type === 'fixed'
                  ? `${c.coupon.discount_value} USDT 할인`
                  : `${c.coupon.discount_value}% 할인${c.coupon.max_discount ? ` (최대 ${c.coupon.max_discount} USDT)` : ''}`}
              </p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 ${selectedId === c.id ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
              {selectedId === c.id && (
                <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default CouponSelector;
