import api from './client';

export interface Notice {
  id: string;
  title: string;
  content: string;
  target: string | null;
  is_pinned: boolean;
  is_active: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  position: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

import type { PaginatedResponse } from './types';

// --- Public ---

export const getNotices = (page = 1, perPage = 20) =>
  api.get<PaginatedResponse<Notice>>('/notices', { params: { page, per_page: perPage } }).then((r) => r.data);

export const getNotice = (id: string) =>
  api.get<{ data: Notice }>(`/notices/${id}`).then((r) => r.data);

export const getBanners = () =>
  api.get<{ data: Banner[] }>('/banners').then((r) => r.data);

export const getFaqs = (category?: string) =>
  api.get<{ data: Faq[] }>('/faq', { params: { category } }).then((r) => r.data);

// --- Admin ---

export const createNotice = (data: { title: string; content: string; is_pinned?: boolean }) =>
  api.post('/admin/notices', data).then((r) => r.data);

export const updateNotice = (id: string, data: { title?: string; content?: string; is_pinned?: boolean; is_active?: boolean }) =>
  api.put(`/admin/notices/${id}`, data).then((r) => r.data);

export const deleteNotice = (id: string) =>
  api.delete(`/admin/notices/${id}`).then((r) => r.data);

export const createBanner = (data: { title: string; image_url: string; link_url?: string; sort_order?: number; starts_at?: string; ends_at?: string }) =>
  api.post('/admin/banners', data).then((r) => r.data);

export const updateBanner = (id: string, data: { title?: string; image_url?: string; link_url?: string; sort_order?: number; is_active?: boolean; starts_at?: string; ends_at?: string }) =>
  api.put(`/admin/banners/${id}`, data).then((r) => r.data);

export const deleteBanner = (id: string) =>
  api.delete(`/admin/banners/${id}`).then((r) => r.data);

export const createFaq = (data: { category?: string; question: string; answer: string; sort_order?: number }) =>
  api.post('/admin/faq', data).then((r) => r.data);

export const updateFaq = (id: string, data: { category?: string; question?: string; answer?: string; sort_order?: number; is_active?: boolean }) =>
  api.put(`/admin/faq/${id}`, data).then((r) => r.data);

export const deleteFaq = (id: string) =>
  api.delete(`/admin/faq/${id}`).then((r) => r.data);

// --- FAQ Categories ---
export interface FaqCategory {
  name: string;
  faq_count: number;
}

export const getFaqCategories = () =>
  api.get<{ data: FaqCategory[] }>('/admin/faq/categories').then((r) => r.data);

export const addFaqCategory = (name: string) =>
  api.post('/admin/faq/categories', { name }).then((r) => r.data);

export const renameFaqCategory = (name: string, newName: string) =>
  api.put(`/admin/faq/categories/${encodeURIComponent(name)}`, { new_name: newName }).then((r) => r.data);

export const deleteFaqCategory = (name: string) =>
  api.delete(`/admin/faq/categories/${encodeURIComponent(name)}`).then((r) => r.data);
