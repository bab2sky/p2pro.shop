import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from './Header';
import { CategoryNav } from './CategoryNav';
import { Footer } from './Footer';
import { MobileBottomNav } from './MobileBottomNav';
import { FloatingChat } from '@/components/chat/FloatingChat';
import { useNotificationWs } from '@/hooks/useNotificationWs';

export function RootLayout() {
  useNotificationWs();

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      <Header />
      <CategoryNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8 pb-16 md:pb-4">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
      <FloatingChat />
      <Toaster position="top-right" richColors />
    </div>
  );
}
