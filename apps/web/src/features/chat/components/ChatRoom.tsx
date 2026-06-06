import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChatMessages, markChatRead, uploadChatImage, sendImageMessage, type ChatMessageInfo } from '@/lib/api/chat';
import { ChatWebSocket, type WsMessage } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';

interface ChatRoomProps {
  roomId: string;
  otherUserNickname?: string | null;
}

export function ChatRoom({ roomId, otherUserNickname }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessageInfo[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<ChatWebSocket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Initial message load
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['chatMessages', roomId],
    queryFn: () => getChatMessages(roomId),
    enabled: !!roomId,
  });

  // Set initial messages
  useEffect(() => {
    if (initialData) {
      // Messages come in DESC order from API, reverse for display
      setMessages([...initialData.data].reverse());
      setHasMore(initialData.has_more);
    }
  }, [initialData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read on mount and when new messages arrive
  useEffect(() => {
    if (roomId) {
      markChatRead(roomId).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
    }
  }, [roomId, queryClient]);

  // WebSocket connection
  useEffect(() => {
    if (!roomId || !accessToken) return;

    const handleMessage = (msg: WsMessage) => {
      switch (msg.type) {
        case 'message': {
          const newMsg: ChatMessageInfo = {
            id: msg.id as string,
            sender_id: msg.sender_id as string,
            content: msg.content as string,
            is_read: false,
            created_at: msg.created_at as string,
            message_type: (msg.message_type as 'text' | 'image') || 'text',
            image_url: (msg.image_url as string) || null,
            image_thumbnail: (msg.image_thumbnail as string) || null,
          };
          setMessages((prev) => [...prev, newMsg]);
          // Mark as read if the message is from the other user
          if (msg.sender_id !== currentUserId) {
            wsRef.current?.sendRead();
            markChatRead(roomId).catch(() => {});
          }
          queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
          break;
        }
        case 'typing': {
          if (msg.sender_id !== currentUserId) {
            setIsTyping(true);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
          }
          break;
        }
        case 'read': {
          // Mark all sent messages as read
          setMessages((prev) =>
            prev.map((m) =>
              m.sender_id === currentUserId ? { ...m, is_read: true } : m,
            ),
          );
          break;
        }
        case 'chat_message': {
          // Image messages broadcast from server via REST API
          const data = msg.data as Record<string, unknown> | undefined;
          if (data) {
            const imgMsg: ChatMessageInfo = {
              id: data.id as string,
              sender_id: data.sender_id as string,
              content: (data.content as string) || '[이미지]',
              is_read: false,
              created_at: (data.created_at as string) || new Date().toISOString(),
              message_type: (data.message_type as 'text' | 'image') || 'image',
              image_url: (data.image_url as string) || null,
              image_thumbnail: (data.image_thumbnail as string) || null,
            };
            setMessages((prev) => [...prev, imgMsg]);
            if (data.sender_id !== currentUserId) {
              wsRef.current?.sendRead();
              markChatRead(roomId).catch(() => {});
            }
            queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
          }
          break;
        }
        case 'error': {
          console.error('[Chat] Server error:', msg.message);
          break;
        }
      }
    };

    const ws = new ChatWebSocket(roomId, accessToken, handleMessage);
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [roomId, accessToken, currentUserId, queryClient]);

  const handleSend = useCallback(
    (content: string) => {
      wsRef.current?.send(content);
    },
    [],
  );

  const handleTyping = useCallback(() => {
    wsRef.current?.sendTyping();
  }, []);

  const handleSendImage = useCallback(
    async (file: File) => {
      // Upload the file, then send as image message via REST API
      const imageUrl = await uploadChatImage(file);
      await sendImageMessage(roomId, imageUrl);
      // The server will broadcast via WebSocket; the message will appear from the WS handler
    },
    [roomId],
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldestMsg = messages[0];
    try {
      const result = await getChatMessages(roomId, {
        before: oldestMsg.id,
        limit: 50,
      });
      const olderMessages = [...result.data].reverse();
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(result.has_more);
    } catch (err) {
      console.error('Failed to load more messages', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, messages, roomId]);

  if (!roomId) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Select a conversation to start chatting
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {otherUserNickname || 'Chat'}
        </h3>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-label="채팅 메시지"
      >
        {hasMore && (
          <div className="mb-3 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-8 text-gray-400">Loading messages...</div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            content={msg.content}
            isMine={msg.sender_id === currentUserId}
            timestamp={msg.created_at}
            isRead={msg.is_read}
            messageType={msg.message_type}
            imageUrl={msg.image_url}
          />
        ))}

        {isTyping && (
          <div className="mb-2 text-xs text-gray-400 italic">typing...</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} onSendImage={handleSendImage} onTyping={handleTyping} />
    </div>
  );
}
