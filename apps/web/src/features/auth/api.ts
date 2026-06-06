import api from '@/lib/api/client';

export interface UserProfile {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  phone: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_udg_member: boolean;
  is_2fa_enabled: boolean;
  locale: string | null;
  theme: string | null;
  status: string | null;
}

export interface AuthData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserProfile;
}

export interface AuthResponse {
  data: AuthData;
}

export interface SignupPayload {
  email: string;
  password: string;
  real_name?: string;
  nickname?: string;
  phone?: string;
  referrer_code?: string;
  is_udg_member?: boolean;
  terms_agreed: boolean;
  privacy_agreed: boolean;
  marketing_agreed?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  totp_code?: string;
}

export const authApi = {
  signup: (data: SignupPayload) =>
    api.post<AuthResponse>('/auth/signup', data),

  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', data),

  login2fa: (data: { email: string; password: string; totp_code: string }) =>
    api.post<AuthResponse>('/auth/login-2fa', data),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password', { token, new_password }),

  checkReferrer: (code: string) =>
    api.post<{ data: { valid: boolean; nickname?: string } }>('/auth/check-referrer', { code }),

  checkEmailDuplicate: (email: string) =>
    api.post<{ data: { available: boolean } }>('/auth/check-email', { email }),

  sendVerificationCode: (email: string) =>
    api.post<{ data: { message: string } }>('/auth/send-verification', { email }),

  verifyEmailCode: (email: string, code: string) =>
    api.post<{ data: { verified: boolean } }>('/auth/verify-email', { email, code }),

  checkPhoneDuplicate: (phone: string) =>
    api.post<{ data: { available: boolean } }>('/auth/check-phone', { phone }),
};
