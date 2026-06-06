import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  LayoutGrid,
  Ticket,
  ShoppingBag,
  ScanLine,
  Truck,
  AlertTriangle,
  RotateCcw,
  Star,
  Wallet,
  TrendingUp,
  Megaphone,
  Image,
  HelpCircle,
  Mail,
  ScrollText,
  Settings,
  ArrowLeft,
  Bot,
  Zap,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: React.ReactNode;
}

const iconClass = 'h-4 w-4';

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: '홈',
    items: [
      { to: '/admin', label: '대시보드', end: true, icon: <LayoutDashboard className={iconClass} /> },
    ],
  },
  {
    title: '사용자',
    items: [
      { to: '/admin/users', label: '회원 관리', icon: <Users className={iconClass} /> },
      { to: '/admin/sellers', label: '판매자 관리', icon: <Store className={iconClass} /> },
    ],
  },
  {
    title: '상품',
    items: [
      { to: '/admin/products', label: '상품 관리', icon: <Package className={iconClass} /> },
      { to: '/admin/categories', label: '카테고리', icon: <LayoutGrid className={iconClass} /> },
      { to: '/admin/coupons', label: '쿠폰 관리', icon: <Ticket className={iconClass} /> },
      { to: '/admin/timedeals', label: '타임딜 관리', icon: <Zap className={iconClass} /> },
    ],
  },
  {
    title: '주문/결제',
    items: [
      { to: '/admin/orders', label: '주문 관리', icon: <ShoppingBag className={iconClass} /> },
      { to: '/admin/txid', label: 'TXID 검증', icon: <ScanLine className={iconClass} /> },
      { to: '/admin/shipping', label: '배송 관리', icon: <Truck className={iconClass} /> },
    ],
  },
  {
    title: '고객 관리',
    items: [
      { to: '/admin/disputes', label: '분쟁 관리', icon: <AlertTriangle className={iconClass} /> },
      { to: '/admin/refunds', label: '환불 관리', icon: <RotateCcw className={iconClass} /> },
      { to: '/admin/reviews', label: '리뷰 관리', icon: <Star className={iconClass} /> },
    ],
  },
  {
    title: '정산',
    items: [
      { to: '/admin/withdrawals', label: '출금 관리', icon: <Wallet className={iconClass} /> },
      { to: '/admin/profit', label: '플랫폼 수익', icon: <TrendingUp className={iconClass} /> },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { to: '/admin/notices', label: '공지사항', icon: <Megaphone className={iconClass} /> },
      { to: '/admin/banners', label: '배너', icon: <Image className={iconClass} /> },
      { to: '/admin/faq', label: 'FAQ', icon: <HelpCircle className={iconClass} /> },
    ],
  },
  {
    title: '시스템',
    items: [
      { to: '/admin/chatbot', label: 'AI 챗봇', icon: <Bot className={iconClass} /> },
      { to: '/admin/email-logs', label: '이메일 로그', icon: <Mail className={iconClass} /> },
      { to: '/admin/logs', label: '활동 로그', icon: <ScrollText className={iconClass} /> },
      { to: '/admin/audit-logs', label: '감사 로그', icon: <ScrollText className={iconClass} /> },
      { to: '/admin/settings', label: '시스템 설정', icon: <Settings className={iconClass} /> },
    ],
  },
];

export function AdminSidebar() {
  return (
    <aside className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto rounded-r-2xl border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Admin</h2>
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
                  `mx-2 mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-900 font-bold text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-white dark:text-gray-900' : 'text-gray-400 dark:text-gray-500'}>
                      {item.icon}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <NavLink
          to="/"
          className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          스토어로 돌아가기
        </NavLink>
      </div>
    </aside>
  );
}
