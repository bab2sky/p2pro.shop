import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, MessageCircle, ShoppingCart, Heart, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';

export function MobileBottomNav() {
    const { t } = useTranslation();
    const location = useLocation();
    const { user } = useAuthStore();
    const cartCount = useCartStore((s) => s.items.length);

    const navItems = [
        { name: t('common.home', '홈'), path: '/', icon: Home },
        { name: t('common.menu.chat', '채팅'), path: null, icon: MessageCircle, action: 'chat' },
        { name: t('common.cart', '장바구니'), path: '/cart', icon: ShoppingCart, badge: cartCount },
        { name: t('common.menu.wishlistShort', '찜'), path: '/wishlist', icon: Heart },
        { name: t('common.menu.myShort', '마이'), path: user ? '/my' : '/login', icon: User },
    ] as const;

    // 관리자/판매자 페이지에서는 숨김
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/seller')) {
        return null;
    }

    const handleChatClick = () => {
        window.dispatchEvent(new Event('open-floating-chat'));
    };

    return (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-gray-200 bg-white/95 px-2 backdrop-blur-md md:hidden dark:border-gray-800 dark:bg-gray-950/95 pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
                const isActive = item.path ? (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))) : false;
                const Icon = item.icon;

                if ('action' in item && item.action === 'chat') {
                    return (
                        <button
                            key={item.name}
                            onClick={handleChatClick}
                            className="relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 text-gray-400 transition-colors hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-50"
                        >
                            <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                            <span className="text-[12px] font-medium">{item.name}</span>
                        </button>
                    );
                }

                return (
                    <Link
                        key={item.name}
                        to={item.path!}
                        className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors ${isActive
                            ? 'text-gray-900 dark:text-gray-50'
                            : 'text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-50'
                            }`}
                    >
                        <div className="relative">
                            <Icon
                                className="h-[22px] w-[22px]"
                                strokeWidth={isActive ? 2.5 : 1.8}
                            />
                            {'badge' in item && item.badge != null && item.badge > 0 && (
                                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                                    {item.badge > 99 ? '99+' : item.badge}
                                </span>
                            )}
                        </div>
                        <span className={`text-[12px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                            {item.name}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
