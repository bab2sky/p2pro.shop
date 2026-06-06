import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateNotifications } from '@/lib/api/profile';
import type { NotificationSettings as NotifSettings } from '@/lib/api/profile';

export function NotificationSettings() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfile().then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (settings: NotifSettings) => updateNotifications(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800" /></div>;

  const settings = profile?.notification_settings || { order: true, chat: true, shipping: true, notice: true };

  const toggleSetting = (key: keyof NotifSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    mutation.mutate(updated);
  };

  const items: { key: keyof NotifSettings; label: string; desc: string }[] = [
    { key: 'order', label: '주문 알림', desc: '주문 상태 변경, 결제 확인 등' },
    { key: 'chat', label: '채팅 알림', desc: '새 메시지 수신 시' },
    { key: 'shipping', label: '배송 알림', desc: '배송 시작, 배송 완료 등' },
    { key: 'notice', label: '공지사항', desc: '새 공지사항, 이벤트 등' },
  ];

  return (
    <div>
      <h2 className="mb-5 text-[15px] font-bold text-gray-900 dark:text-white">알림 설정</h2>
      <div className="space-y-1">
        {items.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between rounded-xl px-1 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">{desc}</p>
            </div>
            <button
              onClick={() => toggleSetting(key)}
              disabled={mutation.isPending}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                settings[key] ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform dark:bg-gray-900 ${
                  settings[key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
      {mutation.isError && (
        <p className="mt-3 text-[13px] text-red-500">설정 변경에 실패했습니다</p>
      )}
    </div>
  );
}
