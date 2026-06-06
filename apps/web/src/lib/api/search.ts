import api from './client';

export interface PopularKeyword {
  rank: number;
  keyword: string;
  count: number;
}

export const getPopularKeywords = (period?: 'daily' | 'weekly') =>
  api.get<{ data: PopularKeyword[] }>('/search/popular', { params: { period } }).then((r) => r.data);

export const logSearchKeyword = (keyword: string) =>
  api.post('/search/log', { keyword }).then((r) => r.data);
