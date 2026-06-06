import { Outlet } from 'react-router-dom';
import { MySidebar } from './MySidebar';

export function MyPageLayout() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="md:flex md:gap-6">
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <div className="sticky top-20 w-56 shrink-0 rounded-2xl border border-gray-200 bg-gray-50 py-2 dark:border-gray-800 dark:bg-gray-900">
              <MySidebar />
            </div>
          </div>

          {/* Content */}
          <main className="min-w-0 flex-1 py-2 md:py-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
