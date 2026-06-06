import { useQuery } from '@tanstack/react-query';
import { getChatRooms, type ChatRoomInfo } from '@/lib/api/chat';

interface ChatRoomListProps {
  activeRoomId?: string;
  onSelectRoom: (room: ChatRoomInfo) => void;
}

export function ChatRoomList({ activeRoomId, onSelectRoom }: ChatRoomListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['chatRooms'],
    queryFn: getChatRooms,
    refetchInterval: 10000,
  });

  const rooms = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400" role="status" aria-label="로딩 중">
        Loading...
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room)}
          className={`w-full border-b px-4 py-3 text-left transition hover:bg-gray-50 ${
            activeRoomId === room.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 truncate">
              {room.other_user_nickname || 'User'}
            </span>
            {room.unread_count > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                {room.unread_count > 99 ? '99+' : room.unread_count}
              </span>
            )}
          </div>
          {room.last_message && (
            <p className="mt-1 truncate text-xs text-gray-500">
              {room.last_message}
            </p>
          )}
          {room.last_message_at && (
            <p className="mt-0.5 text-xs text-gray-400">
              {formatRelativeTime(room.last_message_at)}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
