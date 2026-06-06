import api from './client';

export interface CartGroup {
  seller_id: string;
  seller_name: string;
  items: CartItemDetail[];
  subtotal: string;
  shipping_fee: string;
}

export interface CartItemDetail {
  id: string;
  product_id: string;
  product_title: string;
  product_image: string | null;
  option_id: string | null;
  option_label: string | null;
  unit_price: string;
  quantity: number;
  subtotal: string;
  stock: number;
  category_name: string | null;
}

export const getCart = () =>
  api.get<{ data: CartGroup[] }>('/cart').then((r) => r.data.data);

export const addToCart = (data: { product_id: string; option_id?: string; quantity: number }) =>
  api.post('/cart', data).then((r) => r.data);

export const updateCartItem = (id: string, quantity: number) =>
  api.put(`/cart/${id}`, { quantity }).then((r) => r.data);

export const removeCartItem = (id: string) =>
  api.delete(`/cart/${id}`).then((r) => r.data);
