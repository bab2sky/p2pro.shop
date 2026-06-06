import { useDeliveryTracking } from './useDeliveryTracking';

interface TrackingEvent {
  time: string;
  location: string;
  description: string;
  status: string;
}

interface DeliveryTimelineProps {
  orderId: string;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="relative space-y-5 pl-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-56 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeliveryTimeline({ orderId }: DeliveryTimelineProps) {
  const { data: tracking, isLoading, error, refetch } = useDeliveryTracking(orderId);

  if (isLoading) return <TimelineSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="text-[13px] text-red-500">배송 추적 정보를 불러오지 못했습니다.</p>
        <button
          onClick={() => refetch()}
          className="rounded-full bg-gray-100 px-4 py-1.5 text-[12px] font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!tracking) return null;

  const events: TrackingEvent[] = (tracking.events as TrackingEvent[]) || [];

  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <TimelineHeader status={tracking.status} carrierName={tracking.carrier_name} trackingNumber={tracking.tracking_number} />
        <div className="flex flex-col items-center py-6">
          <p className="text-[13px] text-gray-400">배송 추적 정보가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TimelineHeader status={tracking.status} carrierName={tracking.carrier_name} trackingNumber={tracking.tracking_number} />

      {tracking.estimated_delivery && (
        <p className="text-[12px] text-gray-400">
          예상 배송일: {new Date(tracking.estimated_delivery).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
        </p>
      )}

      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-1.5 bottom-1.5 w-0.5 bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-5">
          {events.map((event, i) => {
            const isLatest = i === 0;
            const isDelivered = tracking.status === 'delivered' && i === 0;
            const nodeColor = isDelivered
              ? 'bg-emerald-500 border-emerald-500 ring-4 ring-emerald-500/20'
              : isLatest
                ? 'bg-indigo-500 border-indigo-500 ring-4 ring-indigo-500/20'
                : event.status === 'delivered'
                  ? 'bg-emerald-400 border-emerald-400'
                  : event.status === 'in_transit'
                    ? 'bg-blue-400 border-blue-400'
                    : 'bg-gray-300 border-gray-300 dark:bg-gray-600 dark:border-gray-600';

            return (
              <div key={i} className="relative">
                {/* Timeline node */}
                <div
                  className={`absolute -left-8 top-0.5 rounded-full border-2 ${nodeColor} ${
                    isLatest ? 'h-4 w-4 -ml-0.5' : 'h-3 w-3'
                  }`}
                />

                {/* Event content */}
                <div>
                  <p
                    className={`text-[13px] ${
                      isLatest
                        ? 'font-bold text-gray-900 dark:text-white'
                        : 'font-medium text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {event.description}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                    {event.location && (
                      <>
                        <span>{event.location}</span>
                        <span>|</span>
                      </>
                    )}
                    <span>
                      {new Date(event.time).toLocaleString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineHeader({
  status,
  carrierName,
  trackingNumber,
}: {
  status: string;
  carrierName: string;
  trackingNumber: string;
}) {
  const statusLabels: Record<string, string> = {
    pending: '준비 중',
    in_transit: '배송 중',
    out_for_delivery: '배달 중',
    delivered: '배송 완료',
    exception: '배송 이상',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    in_transit: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    out_for_delivery: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    exception: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">배송 추적</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            statusColors[status] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {statusLabels[status] || status}
        </span>
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">
        {carrierName} | {trackingNumber}
      </p>
    </>
  );
}

export default DeliveryTimeline;
