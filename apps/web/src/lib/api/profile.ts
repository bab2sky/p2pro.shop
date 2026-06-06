import api from './client';

export interface AccountProfile {
  id: string;
  email: string;
  nickname: string;
  profile_image: string | null;
  role: string;
  totp_enabled: boolean;
  referral_code: string;
  referral_count: number;
  notification_settings: NotificationSettings;
  account_status: string;
  created_at: string;
  updated_at: string;
}

export interface TotpSetupResponse {
  secret: string;
  qr_url: string;
  backup_codes: string[];
}

export interface UserWallet {
  id: string;
  user_id: string;
  label: string;
  network: string;
  address: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  order: boolean;
  chat: boolean;
  shipping: boolean;
  notice: boolean;
}

// --- Profile ---

export const getProfile = () =>
  api.get<{ data: AccountProfile }>('/profile').then((r) => r.data);

export const updateProfile = (data: { nickname?: string; profile_image?: string }) =>
  api.put<{ data: AccountProfile }>('/profile', data).then((r) => r.data);

export const changePassword = (data: { current_password: string; new_password: string }) =>
  api.put('/profile/password', data).then((r) => r.data);

// --- TOTP ---

export const setupTotp = () =>
  api.post<{ data: TotpSetupResponse }>('/profile/totp/setup').then((r) => r.data);

export const verifyTotp = (code: string) =>
  api.post<{ data: { enabled: boolean } }>('/profile/totp/verify', { code }).then((r) => r.data);

export const disableTotp = (code: string) =>
  api.delete('/profile/totp', { data: { code } }).then((r) => r.data);

// --- Wallets ---

export const getWallets = () =>
  api.get<{ data: UserWallet[] }>('/profile/wallets').then((r) => r.data);

export const addWallet = (data: { label: string; network: string; address: string; totp_code?: string }) =>
  api.post<{ data: UserWallet }>('/profile/wallets', data).then((r) => r.data);

export const requestWalletChange = (data: {
  name: string;
  phone: string;
  current_address: string;
  new_address: string;
  network: string;
}) =>
  api.post<{ data: { id: string; status: string } }>('/profile/wallets/change-request', data).then((r) => r.data);

export const deleteWallet = (id: string, totp_code: string) =>
  api.delete(`/profile/wallets/${id}`, { data: { totp_code } }).then((r) => r.data);

// --- Notifications ---

export const updateNotifications = (settings: NotificationSettings) =>
  api.put('/profile/notifications', settings).then((r) => r.data);

// --- Account ---

export const deactivateAccount = (data: { totp_code?: string; reason: string }) =>
  api.post('/profile/deactivate', data).then((r) => r.data);
