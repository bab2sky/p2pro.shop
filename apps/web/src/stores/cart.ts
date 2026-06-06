import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GuestCartItem {
  product_id: string;
  option_id?: string;
  quantity: number;
  title: string;
  price: string;
  image?: string;
  option_label?: string;
}

interface CartState {
  items: GuestCartItem[];
  addItem: (item: GuestCartItem) => void;
  updateQuantity: (product_id: string, option_id: string | undefined, quantity: number) => void;
  removeItem: (product_id: string, option_id: string | undefined) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const idx = state.items.findIndex(
            (i) => i.product_id === item.product_id && i.option_id === item.option_id,
          );
          if (idx >= 0) {
            const items = [...state.items];
            items[idx] = { ...items[idx], quantity: items[idx].quantity + item.quantity };
            return { items };
          }
          return { items: [...state.items, item] };
        }),
      updateQuantity: (product_id, option_id, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product_id === product_id && i.option_id === option_id
              ? { ...i, quantity: Math.max(1, quantity) }
              : i,
          ),
        })),
      removeItem: (product_id, option_id) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.product_id === product_id && i.option_id === option_id),
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'p2pro-cart' },
  ),
);
