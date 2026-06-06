import { lazy, Suspense } from 'react';

const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

export default function MySettingsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <ProfilePage />
    </Suspense>
  );
}
