import { cn } from '@/lib/utils';
import {
  ORDER_STATUS_COLORS,
  REFUND_STATUS_COLORS,
  DISPUTE_STATUS_COLORS,
} from '@/constants/status-maps';

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'product' | 'seller' | 'dispute' | 'refund';
}

const TYPE_COLOR_MAP: Record<string, Record<string, string>> = {
  order: ORDER_STATUS_COLORS,
  refund: REFUND_STATUS_COLORS,
  dispute: DISPUTE_STATUS_COLORS,
};

const FALLBACK_COLORS: Record<string, string> = {
  // Common
  pending: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
  active: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  approved: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  confirmed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',

  // Product statuses
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  out_of_stock: 'bg-red-50 text-red-600 dark:bg-red-500/10',
  discontinued: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',

  // Seller statuses
  under_review: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-500/10',
  suspended: 'bg-red-50 text-red-600 dark:bg-red-500/10',
  banned: 'bg-red-50 text-red-600 dark:bg-red-500/10',
};

const DEFAULT_COLOR = 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500';

function getStatusColor(status: string, type?: string): string {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');

  if (type && TYPE_COLOR_MAP[type]) {
    const color = TYPE_COLOR_MAP[type][normalized];
    if (color) return color;
  }

  return FALLBACK_COLORS[normalized] ?? DEFAULT_COLOR;
}

function formatLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, type }: StatusBadgeProps) {
  const colorClass = getStatusColor(status, type);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
        colorClass,
      )}
    >
      {formatLabel(status)}
    </span>
  );
}
