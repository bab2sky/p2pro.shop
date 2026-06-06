/**
 * Common API types used across multiple endpoints.
 * Round 8b (Audit FE-BE M-10): Pagination 인터페이스가 6개 파일에 중복 정의되어
 * 단일 출처 (single source of truth) 로 통합. 각 파일은 여기서 re-export.
 */

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/**
 * Standard list response shape: `{ data: T[], pagination: Pagination }`.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

/**
 * Backend error envelope: `{ error: { code, message, field? } }`.
 */
export interface ApiError {
  code: string;
  message: string;
  field?: string;
}
