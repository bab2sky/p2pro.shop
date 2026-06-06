import api from './client';
import type { Pagination } from './types';

export interface Review {
  id: string;
  rating: number;
  content: string | null;
  images: string[];
  helpful_count: number;
  unhelpful_count: number;
  seller_reply: string | null;
  seller_replied_at: string | null;
  created_at: string;
  user_nickname: string | null;
}

export interface ReviewVoteResponse {
  helpful_count: number;
  unhelpful_count: number;
  user_voted: boolean;
}

export interface ReviewFilterParams {
  rating?: number;
  has_images?: boolean;
  sort?: 'latest' | 'rating_high' | 'rating_low' | 'helpful';
  page?: number;
  per_page?: number;
}

export interface ReviewStats {
  avg_rating: number;
  total_count: number;
  distribution: { '5': number; '4': number; '3': number; '2': number; '1': number };
}

export const getProductReviews = (productId: string, params?: ReviewFilterParams) =>
  api.get<{ data: Review[]; pagination: Pagination }>(`/products/${productId}/reviews`, { params }).then((r) => r.data);

export const voteReview = (reviewId: string, is_helpful: boolean) =>
  api.post<{ data: ReviewVoteResponse }>(`/reviews/${reviewId}/vote`, { is_helpful }).then((r) => r.data);

export const setOptionImage = (optionId: string, image_url: string) =>
  api.put(`/product-options/${optionId}/image`, { image_url }).then((r) => r.data);

export const getReviewStats = (productId: string) =>
  api.get<{ data: ReviewStats }>(`/products/${productId}/reviews/stats`).then((r) => r.data);

export interface ReviewableOrder {
  id: string;
  order_number: string;
}

export const getReviewableOrders = (productId: string) =>
  api.get<{ data: ReviewableOrder[] }>(`/products/${productId}/reviewable-orders`).then((r) => r.data);

export const createReview = (data: { order_id: string; rating: number; content?: string; images?: string[] }) =>
  api.post('/reviews', data).then((r) => r.data);

export const updateReview = (id: string, data: { rating?: number; content?: string; images?: string[] }) =>
  api.put(`/reviews/${id}`, data).then((r) => r.data);

export const deleteReview = (id: string) =>
  api.delete(`/reviews/${id}`).then((r) => r.data);

export const uploadImage = (file: File, category: string) => {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  return api.post('/upload', form).then((r) => r.data);
};
