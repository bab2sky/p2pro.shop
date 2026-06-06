import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '@/lib/api/notifications';

export function NotificationList() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list', page],
    queryFn: () => notificationApi.list(page).then((r) => r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading || !data) return <div className="p-6 text-gray-500" role="status" aria-label="로딩 중">Loading...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button
          onClick={() => markAllMutation.mutate()}
          className="text-sm text-gray-900 dark:text-white hover:underline"
        >
          Mark all read
        </button>
      </div>

      <div className="space-y-2">
        {data.data.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              if (!n.is_read) markReadMutation.mutate(n.id);
              if (n.link) navigate(n.link);
            }}
            className={`w-full rounded-2xl border p-4 text-left hover:bg-gray-50 ${
              !n.is_read ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-900 dark:bg-white" />}
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-gray-600">{n.message}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </button>
        ))}

        {data.data.length === 0 && (
          <p className="py-12 text-center text-gray-400">No notifications</p>
        )}
      </div>

      {data.pagination.total_pages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-500">{page} / {data.pagination.total_pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pagination.total_pages} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
