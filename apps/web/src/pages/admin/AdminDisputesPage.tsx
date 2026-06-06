import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminDisputeTable, AdminDisputeResolve } from '@/features/admin';
import { getAdminDisputeStats } from '@/lib/api/disputes';
import type { Dispute } from '@/lib/api/disputes';
import { Scale, AlertTriangle, Loader, CheckCircle2, XCircle, DollarSign } from 'lucide-react';

const STAT_CONFIG = [
  { key: 'total', label: '전체 분쟁', icon: Scale, color: 'gray' },
  { key: 'open', label: '접수 (대기)', icon: AlertTriangle, color: 'red' },
  { key: 'in_progress', label: '처리 중', icon: Loader, color: 'yellow' },
  { key: 'resolved', label: '해결됨', icon: CheckCircle2, color: 'green' },
  { key: 'closed', label: '종료', icon: XCircle, color: 'gray' },
  { key: 'total_refund_amount', label: '총 환불 금액', icon: DollarSign, color: 'pink' },
] as const;

const iconBgMap: Record<string, string> = {
  gray: 'bg-gray-100 dark:bg-gray-800',
  red: 'bg-red-50 dark:bg-red-900/20',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
  green: 'bg-green-50 dark:bg-green-900/20',
  pink: 'bg-pink-50 dark:bg-pink-900/20',
};

const iconTextMap: Record<string, string> = {
  gray: 'text-gray-500 dark:text-gray-400',
  red: 'text-red-600 dark:text-red-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  green: 'text-green-600 dark:text-green-400',
  pink: 'text-pink-500 dark:text-pink-400',
};

const valueColorMap: Record<string, string> = {
  total: 'text-gray-900 dark:text-white',
  open: 'text-red-600',
  in_progress: 'text-yellow-600',
  resolved: 'text-green-600',
  closed: 'text-gray-900 dark:text-white',
  total_refund_amount: 'text-pink-500',
};

export default function AdminDisputesPage() {
  const [selected, setSelected] = useState<Dispute | null>(null);

  const statsQ = useQuery({
    queryKey: ['admin', 'disputes', 'stats'],
    queryFn: getAdminDisputeStats,
  });

  const stats = statsQ.data?.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">분쟁 관리</h1>

      {/* Stats Cards */}
      {statsQ.isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAT_CONFIG.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
              <div className="mb-2 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBgMap[color]}`}>
                  <Icon className={`h-4 w-4 ${iconTextMap[color]}`} />
                </div>
              </div>
              <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
              <p className={`mt-1 text-xl font-bold ${valueColorMap[key]}`}>
                {key === 'total_refund_amount'
                  ? `₮ ${Number(stats[key]).toLocaleString()}`
                  : stats[key]}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminDisputeTable onSelect={setSelected} />
        {selected ? (
          <AdminDisputeResolve
            dispute={selected}
            onSuccess={() => setSelected(null)}
            onCancel={() => setSelected(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 p-12 dark:border-gray-800">
            <Scale className="h-14 w-14 text-gray-200 dark:text-gray-700" />
            <p className="mt-3 font-bold text-gray-400">분쟁을 선택하면 중재 패널이 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
