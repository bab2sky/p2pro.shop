import api from './client';

/**
 * Public seller profile shown on /sellers/{id} and /sellers/{id}/profile.
 * Backend handler: api/seller.rs::public_profile.
 *
 * Note: BigDecimal fields are serialized as strings, NOT numbers.
 * Use parseFloat() at display time.
 */
export interface SellerPublicProfile {
  id: string;
  store_name: string | null;
  profile_image: string | null;
  grade: string;
  grade_badge: string;
  total_sales: number;
  avg_rating: string | null;
  response_rate: string | null;
  member_since: string | null;
  products_count: number;
  recent_reviews: {
    id: string;
    rating: number;
    content: string | null;
    created_at: string | null;
  }[];
}

export interface SellerGrade {
  id: string;
  seller_id: string;
  grade: string;
  score: string;
  total_sales: number;
  avg_rating: string;
  response_rate: string;
  dispute_rate: string;
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

export const getSellerProfile = (id: string) =>
  api.get<{ data: SellerPublicProfile }>(`/sellers/${id}/profile`).then((r) => r.data);

export const getMyGrade = () =>
  api.get<{ data: SellerGrade }>('/seller/grade').then((r) => r.data);
