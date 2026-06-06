import api from './client';

// --- Types ---

export interface BusinessInfo {
  company_name: string;
  representative: string;
  business_number: string;
  online_sales_number: string;
  address: string;
  customer_center: string;
  email: string;
  escrow_service: {
    provider: string;
    description: string;
  };
}

export interface SellerBusinessInfo {
  seller_type: string;
  business_name: string | null;
  business_number: string | null;
  representative_name: string | null;
  business_address: string | null;
  business_type: string | null;
  business_category: string | null;
}

export interface CategoryAttribute {
  id: string;
  category_id: string;
  attribute_name: string;
  attribute_name_en: string | null;
  attribute_type: 'text' | 'select' | 'number' | 'date' | 'boolean';
  is_required: boolean;
  options: string[] | null;
  placeholder: string | null;
  sort_order: number;
}

export interface ProductLegalInfo {
  manufacturer: string | null;
  origin_country: string | null;
  condition: string | null;
  kc_certification: {
    type: string;
    number: string;
    agency: string;
    expires_at?: string;
  } | null;
  category_attributes: { name: string; value: string }[];
  withdrawal_rights: {
    period_days: number;
    conditions: string;
    return_shipping_fee: string;
  };
}

// --- API Functions ---

export async function getBusinessInfo(): Promise<BusinessInfo> {
  const { data } = await api.get('/legal/business-info');
  return data.data;
}

export async function getSellerBusinessInfo(sellerId: string): Promise<SellerBusinessInfo> {
  const { data } = await api.get(`/sellers/${sellerId}/business-info`);
  return data.data;
}

export async function getCategoryAttributes(categoryId: string): Promise<CategoryAttribute[]> {
  const { data } = await api.get(`/categories/${categoryId}/attributes`);
  return data.data;
}

export async function getProductLegalInfo(productId: string): Promise<ProductLegalInfo> {
  const { data } = await api.get(`/products/${productId}/legal-info`);
  return data.data;
}

export async function getTermsOfService(): Promise<string> {
  const { data } = await api.get('/legal/terms');
  return data.data.content;
}

export async function getPrivacyPolicy(): Promise<string> {
  const { data } = await api.get('/legal/privacy');
  return data.data.content;
}

export async function getAboutPage(): Promise<string> {
  const { data } = await api.get('/legal/about');
  return data.data.content;
}

export async function saveProductAttributes(
  productId: string,
  attributes: { attribute_id: string; value: string }[]
): Promise<{ saved_count: number }> {
  const { data } = await api.post(`/products/${productId}/attributes`, { attributes });
  return data.data;
}
