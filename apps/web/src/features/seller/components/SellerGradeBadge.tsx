interface SellerGradeBadgeProps {
  grade: string;
  variant?: 'small' | 'large';
}

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  bronze: {
    label: 'Bronze',
    color: 'text-amber-800',
    bg: 'bg-amber-100',
    icon: 'B',
  },
  silver: {
    label: 'Silver',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    icon: 'S',
  },
  gold: {
    label: 'Gold',
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    icon: 'G',
  },
  platinum: {
    label: 'Platinum',
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-100 dark:bg-gray-800',
    icon: 'P',
  },
  diamond: {
    label: 'Diamond',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    icon: 'D',
  },
};

export function SellerGradeBadge({ grade, variant = 'small' }: SellerGradeBadgeProps) {
  const config = GRADE_CONFIG[grade] || GRADE_CONFIG.bronze;

  if (variant === 'large') {
    return (
      <div className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${config.bg}`}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${config.color} bg-white/60`}>
          {config.icon}
        </span>
        <div>
          <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
          <p className="text-xs text-gray-500">판매자 등급</p>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      <span className="font-bold">{config.icon}</span>
      {config.label}
    </span>
  );
}
