import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

/** Decode JWT payload without a library. Returns null if decoding fails. */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/** Returns true if the token is expired or will expire within `marginSec` seconds. */
function isTokenExpired(token: string, marginSec = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true; // No exp claim — treat as expired
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp - marginSec <= nowSec;
}

export function AuthGuard() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);

  // If the token is expired, clear auth state
  useEffect(() => {
    if (accessToken && isTokenExpired(accessToken)) {
      logout();
    }
  }, [accessToken, logout]);

  if (!accessToken || isTokenExpired(accessToken)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
