interface FreeShippingProgressProps {
  currentTotal: number;
  threshold: number;
  currency?: string;
}

export default function FreeShippingProgress({ currentTotal, threshold, currency = 'USDT' }: FreeShippingProgressProps) {
  if (threshold <= 0) return null;

  const remaining = threshold - currentTotal;
  const percent = Math.min((currentTotal / threshold) * 100, 100);
  const isFree = remaining <= 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 text-sm">
      {isFree ? (
        <p className="text-gray-900 dark:text-white font-medium">🎉 무료배송 조건을 충족했습니다!</p>
      ) : (
        <p className="text-gray-900 dark:text-white">
          🚚 <span className="font-bold">{remaining.toLocaleString()} {currency}</span> 더 구매하면 무료배송!
        </p>
      )}
      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFree ? 'bg-green-500' : 'bg-gray-900 dark:bg-white'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
