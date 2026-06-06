import { lazy, Suspense } from 'react';

const AddressListPage = lazy(() => import('@/pages/AddressListPage'));

export default function MyAddressesPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <AddressListPage />
    </Suspense>
  );
}
