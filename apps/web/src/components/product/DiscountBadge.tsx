interface DiscountBadgeProps {
  originalPrice: number;
  discountPrice: number;
  className?: string;
}

export default function DiscountBadge({ originalPrice, discountPrice, className = '' }: DiscountBadgeProps) {
  if (!discountPrice || discountPrice >= originalPrice) return null;

  const percent = Math.round(((originalPrice - discountPrice) / originalPrice) * 100);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
        -{percent}%
      </span>
      <span className="text-red-600 font-bold">{discountPrice.toLocaleString()} USDT</span>
      <span className="text-gray-400 line-through text-sm">{originalPrice.toLocaleString()}</span>
    </div>
  );
}
