import { HelpCircle } from 'lucide-react';
import { FaqAccordion } from '@/features/content';
import { SimplePageHeader } from '@/components/layout/SimplePageHeader';

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <SimplePageHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
          <HelpCircle className="h-5 w-5" />
          자주 묻는 질문 (FAQ)
        </h1>
        <FaqAccordion />
      </div>
    </div>
  );
}
