import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProfile } from './api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  setAuth: (accessToken: string, refreshToken: string, user: UserProfile) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

// CRIT-02: Tokens persisted in sessionStorage
// - Survives page refresh within same tab
// - Cleared on tab/browser close (prevents token theft)
// - sessionStorage is not accessible cross-tab (safer than localStorage)
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      logout: () => {
        // 다른 zustand store (cart 등) 가 sessionStorage 에 남기는 데이터
        // 까지 모두 정리. 공용 PC 에서 다음 사용자가 이전 세션 데이터를
        // 볼 수 있던 가능성 차단.
        set({ accessToken: null, refreshToken: null, user: null });
        try {
          sessionStorage.clear();
        } catch {
          // sessionStorage 접근 차단된 환경에서도 set 은 이미 적용됨.
        }
      },
    }),
    {
      name: 'p2pro-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
