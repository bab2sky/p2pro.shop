import { TrendingUp, TrendingDown } from 'lucide-react';
import { fmt } from './profitUtils';

export default function ChangeIndicator({ value }: { value: string }) {
  const n = Number(value);
  if (n === 0) return <span className="text-xs text-gray-400">-</span>;
  const isUp = n > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {fmt(Math.abs(n))}%
    </span>
  );
}
