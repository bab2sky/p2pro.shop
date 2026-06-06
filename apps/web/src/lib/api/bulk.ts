import api from './client';

export interface BulkUploadLog {
  id: string;
  upload_type: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  error_details: { row: number; field: string; message: string }[];
  status: string;
  completed_at: string | null;
  created_at: string;
}

export interface BulkUploadResult {
  log_id: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  errors: { row: number; field: string; message: string }[];
}

export interface ProductViewStats {
  total_views: number;
  today_views: number;
  weekly_views: number;
  order_count: number;
  conversion_rate: number;
}

export const bulkUpload = (file: File, uploadType: string) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{ data: BulkUploadResult }>(`/seller/bulk/upload?upload_type=${uploadType}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const getBulkUploadLogs = (params?: { page?: number; per_page?: number }) =>
  api.get<{ data: BulkUploadLog[] }>('/seller/bulk/logs', { params }).then((r) => r.data);

export const downloadTemplate = (uploadType: string) =>
  api.get(`/seller/bulk/template?upload_type=${uploadType}`, { responseType: 'blob' }).then((r) => r.data);

export const duplicateProduct = (productId: string) =>
  api.post<{ data: { id: string } }>(`/seller/products/${productId}/duplicate`).then((r) => r.data);

export const recordProductView = (productId: string) =>
  api.post(`/products/${productId}/view`).then((r) => r.data);

export const getProductViewStats = (productId: string) =>
  api.get<{ data: ProductViewStats }>(`/products/${productId}/views`).then((r) => r.data);
