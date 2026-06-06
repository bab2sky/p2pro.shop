import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { ChatRoomList, ChatRoom } from '@/features/chat';
import type { ChatRoomInfo } from '@/features/chat';

export default function ChatPage() {
  const { id: activeRoomId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const handleSelectRoom = (room: ChatRoomInfo) => {
    navigate(`/chat/${room.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Messages</h1>
      <div className="flex h-[calc(100vh-200px)] min-h-[500px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {/* Room list sidebar */}
        <div className="w-80 shrink-0 border-r border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-[13px] font-bold text-gray-500 dark:text-gray-400">대화 목록</h2>
          </div>
          <ChatRoomList
            activeRoomId={activeRoomId}
            onSelectRoom={handleSelectRoom}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1">
          {activeRoomId ? (
            <ChatRoom
              roomId={activeRoomId}
              key={activeRoomId}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <MessageCircle className="h-14 w-14 text-gray-300 dark:text-gray-600" />
              <p className="text-[13px] font-bold text-gray-400">대화를 선택해주세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
