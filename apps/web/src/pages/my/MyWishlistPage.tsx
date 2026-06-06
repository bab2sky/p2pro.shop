import { lazy, Suspense } from 'react';

const WishlistPage = lazy(() => import('@/pages/WishlistPage'));

export default function MyWishlistPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <WishlistPage />
    </Suspense>
  );
}
