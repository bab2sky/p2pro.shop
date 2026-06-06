import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyDisputes, type Dispute } from '@/lib/api/disputes';
import {
  DISPUTE_STATUS_LABELS as statusLabels,
  DISPUTE_STATUS_COLORS as statusColors,
  DISPUTE_TYPE_LABELS as typeLabels,
} from '@/constants/status-maps';

export function DisputeList() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-disputes'],
    queryFn: () => getMyDisputes().then((r) => r.data),
  });

  if (isLoading) return <div className="animate-pulse rounded-lg border p-6">Loading...</div>;

  const disputes: Dispute[] = data || [];

  if (disputes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>분쟁 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map((dispute) => (
        <Link
          key={dispute.id}
          to={`/disputes/${dispute.id}`}
          className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {typeLabels[dispute.dispute_type] || dispute.dispute_type}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                statusColors[dispute.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {statusLabels[dispute.status] || dispute.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{dispute.reason}</p>
          <p className="mt-2 text-xs text-gray-400">
            {new Date(dispute.created_at).toLocaleDateString('ko')}
          </p>
        </Link>
      ))}
    </div>
  );
}
