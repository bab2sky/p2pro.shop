import api from './client';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

import type { Pagination } from './types';

export const notificationApi = {
  list: (page = 1, perPage = 20) =>
    api.get<{ data: Notification[]; pagination: Pagination }>('/notifications', {
      params: { page, per_page: perPage },
    }),

  unreadCount: () =>
    api.get<{ data: { count: number } }>('/notifications/unread-count'),

  markRead: (id: string) =>
    api.put(`/notifications/${id}/read`),

  markAllRead: () =>
    api.put('/notifications/read-all'),
};
