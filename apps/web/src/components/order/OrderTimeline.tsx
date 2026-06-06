import { CheckCircle, Circle } from 'lucide-react';
import type { OrderEvent } from '@/lib/api/orders';
import { formatDateTime } from '@/lib/datetime';

interface OrderTimelineProps {
  events: OrderEvent[];
}

export function OrderTimeline({ events }: OrderTimelineProps) {
  return (
    <div className="space-y-3">
      {events.map((event, i) => {
        const isLatest = i === events.length - 1;
        return (
          <div key={i} className="flex items-start gap-3">
            {isLatest ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            )}
            <div>
              <p className={`text-[13px] font-bold ${isLatest ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {event.label}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">{formatDateTime(event.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
