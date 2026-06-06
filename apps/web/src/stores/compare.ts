import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_COMPARE = 4;

interface CompareState {
  compareItems: string[];
  addToCompare: (id: string) => boolean;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      compareItems: [],
      addToCompare: (id: string) => {
        const { compareItems } = get();
        if (compareItems.includes(id)) return true;
        if (compareItems.length >= MAX_COMPARE) return false;
        set({ compareItems: [...compareItems, id] });
        return true;
      },
      removeFromCompare: (id: string) =>
        set((state) => ({
          compareItems: state.compareItems.filter((item) => item !== id),
        })),
      clearCompare: () => set({ compareItems: [] }),
      isInCompare: (id: string) => get().compareItems.includes(id),
    }),
    { name: 'compare_items' },
  ),
);
