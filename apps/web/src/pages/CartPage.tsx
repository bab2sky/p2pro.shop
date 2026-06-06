import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Store } from 'lucide-react';
import { getCart, updateCartItem, removeCartItem, type CartGroup } from '@/lib/api/cart';
import { CartItem } from '@/components/cart/CartItem';
import { CartSummary } from '@/components/cart/CartSummary';

export default function CartPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: getCart,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => updateCartItem(id, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeCartItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-7xl space-y-4 py-8">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 120 }} />
        ))}
      </div>
    );

  if (!groups || groups.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center py-20">
        <ShoppingBag className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
        <p className="text-lg font-bold text-gray-900 dark:text-white">{t('cart.empty.title', '장바구니가 비어있습니다')}</p>
        <p className="mt-1 text-[13px] text-gray-400 dark:text-gray-500">{t('cart.empty.subtitle', '마음에 드는 상품을 담아보세요')}</p>
        <button
          onClick={() => navigate('/products')}
          className="mt-5 rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {t('cart.empty.cta', '쇼핑하러 가기')}
        </button>
      </div>
    );
  }

  const totalItems = groups.reduce((sum: number, g: CartGroup) => sum + g.items.length, 0);
  const grandTotal = groups.reduce(
    (sum: number, g: CartGroup) => sum + Number(g.subtotal) + Number(g.shipping_fee),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl py-6" role="main" aria-label={t('cart.title', '장바구니')}>
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">
        {t('cart.title', '장바구니')} <span className="text-gray-400 font-normal text-sm dark:text-gray-500">({t('cart.header.totalItems', { count: totalItems, defaultValue: '총 {{count}}개의 상품' })})</span>
      </h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Product list */}
        <div className="min-w-0 flex-1 space-y-4">
          {groups.map((group: CartGroup) => (
            <div key={group.seller_id} className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
              {/* Seller header */}
              <div className="flex items-center gap-2 bg-gray-50 px-5 py-3 dark:bg-gray-800/50">
                <Store className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{group.seller_name}</span>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {group.items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onUpdateQuantity={(id, qty) => updateMutation.mutate({ id, quantity: qty })}
                    onRemove={(id) => removeMutation.mutate(id)}
                  />
                ))}
              </div>

              {/* Seller subtotal */}
              <div className="flex items-center justify-end gap-3 bg-gray-50 px-5 py-3 dark:bg-gray-800/50">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t('cart.subtotal', '소계')} ₮ {group.subtotal}
                </span>
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">+</span>
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t('cart.shippingFee', '배송비')} ₮ {group.shipping_fee}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Summary sidebar */}
        <div className="w-full lg:w-80">
          <div className="sticky top-20">
            <CartSummary grandTotal={grandTotal} onCheckout={() => navigate('/checkout')} />
          </div>
        </div>
      </div>
    </div>
  );
}
