import api from './client';

export interface ProductSummary {
  id: string;
  title: string;
  final_price: string;
  shipping_fee: string;
  main_image: string | null;
  seller_name: string;
  category_name: string;
  stock: number;
  sold_count: number;
  wishlist_count: number;
  avg_rating: string;
  review_count: number;
  status: string;
  rejected_reason: string | null;
  created_at: string;
}

export interface ProductDetail {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_rating: string | null;
  category: CategoryBreadcrumb | null;
  title: string;
  description: string | null;
  base_price: string;
  margin_rate: string;
  // Backend ProductDetail returns commission_rate (BigDecimal as string).
  commission_rate: string;
  final_price: string;
  shipping_fee: string;
  stock: number;
  sold_count: number;
  view_count: number;
  wishlist_count: number;
  avg_rating: string | null;
  review_count: number;
  return_policy: string | null;
  status: string;
  // Phase A fields (Korean marketplace metadata).
  manufacturer: string | null;
  origin_country: string | null;
  condition: string | null;
  kc_certification: unknown | null;
  is_draft: boolean | null;
  images: ProductImage[];
  options: ProductOption[];
  is_wishlisted: boolean;
  created_at: string;
}

export interface CategoryBreadcrumb {
  id: string;
  name: string;
  slug: string;
  is_digital: boolean;
  parent: CategoryBreadcrumb | null;
}

export interface ProductImage {
  id: string;
  image_url: string;
  sort_order: number;
  is_main: boolean;
}

export interface ProductOption {
  id: string;
  option_name: string;
  option_value: string;
  additional_price: string;
  stock: number;
}

export type { Pagination } from './types';
import type { Pagination } from './types';

export interface ProductListResponse {
  data: ProductSummary[];
  pagination: Pagination;
}

export interface ProductSearchParams {
  q?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  sort?: string;
  condition?: string;
  in_stock?: boolean;
  min_rating?: number;
  free_shipping?: boolean;
  page?: number;
  per_page?: number;
}

export interface CreateProductPayload {
  category_id: string;
  title: string;
  description?: string;
  base_price: string;
  margin_rate: string;
  shipping_fee?: string;
  stock: number;
  return_policy?: string;
  options?: {
    option_name: string;
    option_value: string;
    additional_price?: string;
    stock: number;
  }[];
}

export const getProducts = (params: ProductSearchParams) =>
  api.get<ProductListResponse>('/products', { params }).then((r) => r.data);

export const getProduct = (id: string) =>
  api.get<{ data: ProductDetail }>(`/products/${id}`).then((r) => r.data.data);

export const createProduct = (data: CreateProductPayload) =>
  api.post<{ data: { id: string } }>('/products', data).then((r) => r.data.data);

export const updateProduct = (id: string, data: Partial<CreateProductPayload> & { status?: string }) =>
  api.put(`/products/${id}`, data).then((r) => r.data);

export const deleteProduct = (id: string) =>
  api.delete(`/products/${id}`).then((r) => r.data);

export const getSellerProducts = (params?: { page?: number; per_page?: number; status?: string }) =>
  api.get<ProductListResponse>('/seller/products', { params }).then((r) => r.data);

export const getRelatedProducts = (productId: string) =>
  api.get<{ data: ProductSummary[] }>(`/products/${productId}/related`).then((r) => r.data.data);

export const uploadProductImages = (productId: string, files: File[]) => {
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  return api.post(`/products/${productId}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};
