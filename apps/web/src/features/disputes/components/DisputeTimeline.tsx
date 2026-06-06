interface TimelineProps {
  disputeId: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

const steps = [
  { key: 'open', label: '접수됨' },
  { key: 'responded', label: '답변 완료' },
  { key: 'under_review', label: '검토 중' },
  { key: 'resolved', label: '해결됨' },
];

const statusOrder: Record<string, number> = {
  open: 0,
  responded: 1,
  under_review: 2,
  resolved: 3,
  closed: 3,
};

export function DisputeTimeline({ status, createdAt, resolvedAt }: TimelineProps) {
  const currentIdx = statusOrder[status] ?? 0;

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-200 text-gray-500'
                } ${isCurrent ? 'ring-2 ring-gray-900/10' : ''}`}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span className={`mt-1 text-xs ${isCompleted ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}`}>
                {step.label}
              </span>
              {idx === 0 && (
                <span className="text-[10px] text-gray-400">
                  {new Date(createdAt).toLocaleDateString('ko')}
                </span>
              )}
              {idx === steps.length - 1 && resolvedAt && (
                <span className="text-[10px] text-gray-400">
                  {new Date(resolvedAt).toLocaleDateString('ko')}
                </span>
              )}
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 ${
                  idx < currentIdx ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
