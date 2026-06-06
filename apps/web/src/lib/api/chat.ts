import api from './client';

export interface ChatRoomInfo {
  id: string;
  order_id: string;
  other_user_id: string;
  other_user_nickname: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface ChatMessageInfo {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  message_type?: 'text' | 'image';
  image_url?: string | null;
  image_thumbnail?: string | null;
}

export interface ChatRoom {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string | null;
  created_at: string;
}

export const getChatRooms = () =>
  api.get<{ data: ChatRoomInfo[] }>('/chat/rooms').then((r) => r.data);

export const createChatRoom = (orderId: string) =>
  api
    .post<{ data: ChatRoom }>('/chat/rooms', { order_id: orderId })
    .then((r) => r.data);

export const getChatMessages = (
  roomId: string,
  params?: { before?: string; limit?: number },
) =>
  api
    .get<{ data: ChatMessageInfo[]; has_more: boolean }>(
      `/chat/rooms/${roomId}/messages`,
      { params },
    )
    .then((r) => r.data);

export const markChatRead = (roomId: string) =>
  api
    .put<{ data: { updated: number } }>(`/chat/rooms/${roomId}/read`)
    .then((r) => r.data);

export const uploadChatImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', 'chat');
  const res = await api.post<{ data: { url: string } }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.url;
};

export const sendImageMessage = (roomId: string, imageUrl: string, thumbnailUrl?: string) =>
  api
    .post<{ data: { id: string; room_id: string; message_type: string; image_url: string } }>(
      `/chat/rooms/${roomId}/image`,
      { image_url: imageUrl, thumbnail_url: thumbnailUrl },
    )
    .then((r) => r.data);
