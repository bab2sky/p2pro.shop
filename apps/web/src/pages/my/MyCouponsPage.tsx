import { lazy, Suspense } from 'react';

const CouponsPage = lazy(() => import('@/features/coupons/MyCouponsPage'));

export default function MyCouponsPageWrapper() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <CouponsPage />
    </Suspense>
  );
}
