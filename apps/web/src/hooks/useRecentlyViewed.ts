import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'recently_viewed';
const MAX_ITEMS = 20;

let listeners: (() => void)[] = [];
let cachedSnapshot: string[] = [];
let cachedRaw: string | null = null;

function emitChange() {
  cachedRaw = null; // invalidate cache
  listeners.forEach((l) => l());
}

function getSnapshot(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    cachedSnapshot = raw ? JSON.parse(raw) : [];
    return cachedSnapshot;
  } catch {
    return cachedSnapshot;
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function useRecentlyViewed() {
  const items = useSyncExternalStore(subscribe, getSnapshot);

  const addItem = useCallback((id: string) => {
    const current = getSnapshot().filter((item) => item !== id);
    const updated = [id, ...current].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    emitChange();
  }, []);

  return { items, addItem };
}
