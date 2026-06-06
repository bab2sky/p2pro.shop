import { AlertTriangle } from 'lucide-react';
import { DisputeList } from '@/features/disputes';

export default function DisputesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
        <AlertTriangle className="h-5 w-5" />
        분쟁 내역
      </h1>
      <DisputeList />
    </div>
  );
}
