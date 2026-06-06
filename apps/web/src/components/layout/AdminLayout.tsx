import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AdminSidebar } from '@/features/admin';

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
