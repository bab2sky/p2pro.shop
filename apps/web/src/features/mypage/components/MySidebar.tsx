import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, ShoppingBag, RotateCcw, MapPin, Ticket, Heart, Settings } from 'lucide-react';
import { getDashboard } from '@/lib/api/mypage';
import { useAuthStore } from '@/features/auth';

const menuItems = [
  { path: '/my', label: '대시보드', icon: LayoutDashboard, end: true },
  { path: '/my/orders', label: '주문내역', icon: ShoppingBag, badgeKey: 'orders' as const },
  { path: '/my/refunds', label: '환불/분쟁', icon: RotateCcw, badgeKey: 'refunds' as const },
  { path: '/my/addresses', label: '주소록', icon: MapPin },
  { path: '/my/coupons', label: '쿠폰함', icon: Ticket, badgeKey: 'coupons' as const },
  { path: '/my/wishlist', label: '위시리스트', icon: Heart, badgeKey: 'wishlist' as const },
];

export function MySidebar({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ['my', 'dashboard'],
    queryFn: getDashboard,
    staleTime: 60_000,
  });

  const badges: Record<string, number> = {
    orders: data ? Object.values(data.order_counts).reduce((a, b) => a + b, 0) : 0,
    refunds: 0,
    coupons: data?.coupon_count ?? 0,
    wishlist: data?.wishlist_count ?? 0,
  };

  return (
    <aside className="w-full">
      {/* Profile summary */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white dark:bg-white dark:text-gray-900">
            {(user?.nickname || user?.email || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
              {user?.nickname || user?.email}
            </p>
            {data?.user.is_udg_member && (
              <span className="mt-0.5 inline-block rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-500 dark:bg-pink-500/10">
                UDG 회원
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-2 pb-4">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {item.badgeKey && badges[item.badgeKey] > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900'
                            : 'bg-pink-50 text-pink-500 dark:bg-pink-500/10'
                        }`}
                      >
                        {badges[item.badgeKey]}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="my-3 border-t border-gray-100 dark:border-gray-800" />

        <NavLink
          to="/my/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
              isActive
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`
          }
        >
          <Settings className="h-4 w-4" />
          프로필 설정
        </NavLink>
      </nav>
    </aside>
  );
}
