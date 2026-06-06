import api from './client';

export interface Address {
  id: string;
  label: string | null;
  recipient_name: string;
  recipient_phone: string;
  zipcode: string;
  address1: string;
  address2: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AddressPayload {
  label?: string;
  recipient_name: string;
  recipient_phone: string;
  zipcode: string;
  address1: string;
  address2?: string;
  is_default?: boolean;
}

export const getAddresses = () =>
  api.get<{ data: Address[] }>('/addresses').then((r) => r.data.data);

export const createAddress = (data: AddressPayload) =>
  api.post('/addresses', data).then((r) => r.data);

export const updateAddress = (id: string, data: Partial<AddressPayload>) =>
  api.put(`/addresses/${id}`, data).then((r) => r.data);

export const deleteAddress = (id: string) =>
  api.delete(`/addresses/${id}`).then((r) => r.data);
