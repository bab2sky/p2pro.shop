import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();

  if (!accessToken) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
}
