import { useState } from 'react';

interface DiscountPriceInputProps {
  originalPrice: number;
  discountPrice?: number;
  discountStartsAt?: string;
  discountEndsAt?: string;
  onChange: (data: {
    discount_price?: number;
    discount_starts_at?: string;
    discount_ends_at?: string;
  }) => void;
}

export default function DiscountPriceInput({
  originalPrice,
  discountPrice,
  discountStartsAt,
  discountEndsAt,
  onChange,
}: DiscountPriceInputProps) {
  const [enabled, setEnabled] = useState(!!discountPrice);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onChange({ discount_price: undefined, discount_starts_at: undefined, discount_ends_at: undefined });
    }
  };

  const discountPercent =
    enabled && discountPrice && originalPrice > 0
      ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100)
      : 0;

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm font-medium">할인 가격 설정</span>
      </label>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">할인 가격 (USDT)</label>
              <input
                type="number"
                value={discountPrice || ''}
                onChange={(e) => onChange({
                  discount_price: parseFloat(e.target.value) || undefined,
                  discount_starts_at: discountStartsAt,
                  discount_ends_at: discountEndsAt,
                })}
                className="w-full border rounded px-3 py-2 mt-1"
                placeholder="할인 가격"
                min={0}
                max={originalPrice}
                step="0.01"
              />
              {discountPercent > 0 && (
                <span className="text-xs text-red-500 font-medium">-{discountPercent}%</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">할인 시작일</label>
              <input
                type="datetime-local"
                value={discountStartsAt || ''}
                onChange={(e) => onChange({
                  discount_price: discountPrice,
                  discount_starts_at: e.target.value,
                  discount_ends_at: discountEndsAt,
                })}
                className="w-full border rounded px-3 py-2 mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">할인 종료일</label>
              <input
                type="datetime-local"
                value={discountEndsAt || ''}
                onChange={(e) => onChange({
                  discount_price: discountPrice,
                  discount_starts_at: discountStartsAt,
                  discount_ends_at: e.target.value,
                })}
                className="w-full border rounded px-3 py-2 mt-1 text-sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
