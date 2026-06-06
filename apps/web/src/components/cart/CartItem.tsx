import { useTranslation } from 'react-i18next';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { CartItemDetail } from '@/lib/api/cart';

interface CartItemProps {
  item: CartItemDetail;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-4 px-5 py-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
        {item.product_image ? (
          <img src={item.product_image} alt={item.product_title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No img</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-bold text-gray-900 dark:text-white">{item.product_title}</h3>
        {item.option_label && (
          <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">{item.option_label}</p>
        )}
        <p className="mt-1 text-sm font-bold text-pink-500">₮ {item.unit_price} USDT</p>
        <div className="mt-2.5 flex items-center gap-1">
          <button
            onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-[13px] font-bold text-gray-900 dark:text-white">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white">₮ {item.subtotal}</p>
        <button
          onClick={() => onRemove(item.id)}
          className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
        >
          <Trash2 className="h-3 w-3" />
          {t('cart.item.remove', '삭제')}
        </button>
      </div>
    </div>
  );
}
