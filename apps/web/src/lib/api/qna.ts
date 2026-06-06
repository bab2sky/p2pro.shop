import api from './client';
import type { Pagination } from './types';

export interface QnaItem {
  id: string;
  user_nickname: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  is_secret: boolean;
  created_at: string;
}

export const getProductQna = (productId: string, params?: { page?: number; per_page?: number }) =>
  api.get<{ data: QnaItem[]; pagination: Pagination }>(`/products/${productId}/qna`, { params }).then((r) => r.data);

export const createQuestion = (productId: string, data: { question: string; is_secret?: boolean }) =>
  api.post(`/products/${productId}/qna`, data).then((r) => r.data);

export const createAnswer = (qnaId: string, answer: string) =>
  api.post(`/qna/${qnaId}/answer`, { answer }).then((r) => r.data);
