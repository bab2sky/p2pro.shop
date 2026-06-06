import api from './client';
import type { ProductListResponse } from './products';

export const toggleWishlist = (productId: string) =>
  api.post<{ data: { wishlisted: boolean; wishlist_count: number } }>(`/wishlist/${productId}`).then((r) => r.data.data);

export const getWishlist = (params?: { page?: number; per_page?: number }) =>
  api.get<ProductListResponse>('/wishlist', { params }).then((r) => r.data);
