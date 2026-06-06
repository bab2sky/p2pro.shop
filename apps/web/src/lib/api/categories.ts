import api from './client';
import type { ProductListResponse } from './products';

export interface CategoryTree {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
  icon: string | null;
  depth: number;
  // Backend BigDecimal serializes as string; FE callers parseFloat() to compute.
  commission_rate: string;
  is_digital: boolean;
  product_count?: number | null;
  children: CategoryTree[];
}

export const getCategories = () =>
  api.get<{ data: CategoryTree[] }>('/categories').then((r) => r.data.data);

export const getCategoryProducts = (id: string, params?: { page?: number; per_page?: number }) =>
  api.get<ProductListResponse>(`/categories/${id}/products`, { params }).then((r) => r.data);
