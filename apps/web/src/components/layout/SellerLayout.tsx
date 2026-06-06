import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/lib/api/seller';
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Upload,
  ShoppingBag,
  Truck,
  CheckCircle,
  Star,
  MessageCircle,
  MessagesSquare,
  ArrowLeftRight,
  HelpCircle,
  RotateCcw,
  Ticket,
  Clock,
  Wallet,
  TrendingUp,
  Settings,
  ArrowLeft,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  badge?: number;
  icon: React.ReactNode;
}

function SellerSidebar() {
  const { data: stats } = useQuery({
    queryKey: ['sellerDashboardStats'],
    queryFn: getDashboardStats,
    staleTime: 60_000,
  });

  const iconClass = 'h-4 w-4';

  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: '홈',
      items: [
        { to: '/seller/dashboard', label: '대시보드', end: true, icon: <LayoutDashboard className={iconClass} /> },
        { to: '/seller/stats', label: '매출통계', icon: <BarChart3 className={iconClass} /> },
      ],
    },
    {
      title: '상품',
      items: [
        {
          to: '/seller/products',
          label: '상품관리',
          badge: stats?.pending_products,
          icon: <Package className={iconClass} />,
        },
        { to: '/seller/bulk', label: '대량 등록/수정', icon: <Upload className={iconClass} /> },
      ],
    },
    {
      title: '주문/배송',
      items: [
        {
          to: '/seller/orders',
          label: '주문관리',
          end: true,
          icon: <ShoppingBag className={iconClass} />,
        },
        {
          to: '/seller/orders/shipping',
          label: '배송관리',
          badge: stats ? stats.pending_orders : undefined,
          icon: <Truck className={iconClass} />,
        },
        {
          to: '/seller/orders/confirm',
          label: '구매확정',
          badge: stats?.delivered_orders,
          icon: <CheckCircle className={iconClass} />,
        },
      ],
    },
    {
      title: '고객관리',
      items: [
        {
          to: '/seller/reviews',
          label: '리뷰관리',
          badge: stats?.new_reviews,
          icon: <Star className={iconClass} />,
        },
        {
          to: '/seller/qna',
          label: 'Q&A관리',
          badge: stats?.unanswered_qna,
          icon: <MessageCircle className={iconClass} />,
        },
        { to: '/chat', label: '채팅/문의', icon: <MessagesSquare className={iconClass} /> },
        { to: '/seller/exchanges', label: '교환관리', icon: <ArrowLeftRight className={iconClass} /> },
        { to: '/seller/inquiries', label: '1:1 문의', icon: <HelpCircle className={iconClass} /> },
        { to: '/seller/refunds', label: '환불관리', icon: <RotateCcw className={iconClass} /> },
      ],
    },
    {
      title: '마케팅',
      items: [
        { to: '/seller/coupons', label: '쿠폰관리', icon: <Ticket className={iconClass} /> },
        { to: '/seller/timedeals', label: '타임딜', icon: <Clock className={iconClass} /> },
      ],
    },
    {
      title: '정산',
      items: [
        { to: '/seller/settlement', label: '정산관리', icon: <Wallet className={iconClass} /> },
        { to: '/seller/profit', label: '손익 분석', icon: <TrendingUp className={iconClass} /> },
      ],
    },
    {
      title: '설정',
      items: [
        { to: '/seller/settings', label: '스토어 설정', icon: <Settings className={iconClass} /> },
      ],
    },
  ];

  return (
    <aside className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto rounded-r-2xl border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">판매자 센터</h2>
      </div>
      <nav className="py-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-1">
            <div className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {group.title}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `mx-2 mb-0.5 flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-900 font-bold text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-white dark:text-gray-900' : 'text-gray-400 dark:text-gray-500'}>{item.icon}</span>
                      {item.label}
                    </span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="min-w-[20px] rounded-full bg-pink-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <NavLink to="/" className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          스토어로 돌아가기
        </NavLink>
      </div>
    </aside>
  );
}

export function SellerLayout() {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      <SellerSidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
