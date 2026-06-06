import { Megaphone } from 'lucide-react';
import { NoticeList } from '@/features/content';
import { SimplePageHeader } from '@/components/layout/SimplePageHeader';

export default function NoticesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <SimplePageHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
          <Megaphone className="h-5 w-5" />
          공지사항
        </h1>
        <NoticeList />
      </div>
    </div>
  );
}
