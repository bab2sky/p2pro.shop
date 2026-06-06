import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// F-H5: Refresh token mutex to prevent concurrent refresh races
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          // If a refresh is already in progress, wait for it
          if (!refreshPromise) {
            refreshPromise = axios
              .post('/api/auth/refresh', { refresh_token: refreshToken })
              .then(({ data }) => {
                const authData = data.data;
                useAuthStore.getState().setTokens(authData.access_token, authData.refresh_token);
                return authData.access_token as string;
              })
              .finally(() => {
                refreshPromise = null;
              });
          }

          const newToken = await refreshPromise;
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        } catch {
          useAuthStore.getState().logout();
        }
      }
    }

    return Promise.reject(error);
  },
);

export { api as apiClient };
export default api;
