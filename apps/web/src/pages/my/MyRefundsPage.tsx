import { lazy, Suspense } from 'react';

const RefundListPage = lazy(() => import('@/pages/RefundListPage'));

export default function MyRefundsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <RefundListPage />
    </Suspense>
  );
}
