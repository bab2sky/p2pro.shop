// Shared types between frontend and backend API contracts

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export type UserRole = 'buyer' | 'seller' | 'admin';
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipping'
  | 'delivered'
  | 'confirmed'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded';

export type ProductStatus = 'active' | 'inactive' | 'sold_out' | 'hidden';
