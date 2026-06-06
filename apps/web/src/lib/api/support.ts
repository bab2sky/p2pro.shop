import api from './client';

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSupportResponse {
  reply: string;
}

export const supportApi = {
  sendMessage: (message: string, history: ChatHistoryEntry[]) =>
    api
      .post<{ data: ChatSupportResponse; fallback?: boolean }>('/chat/support', {
        message,
        history,
      })
      .then((r) => r.data),
};
