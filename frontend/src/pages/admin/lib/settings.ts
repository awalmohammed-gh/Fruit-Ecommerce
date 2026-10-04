import { useSyncExternalStore } from "react";

// Stored per browser: it only changes how this admin's screens flag low stock.
const KEY = "greenfarm_admin_low_stock";
export const DEFAULT_LOW_STOCK = 10;
const listeners = new Set<() => void>();

function read() {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isInteger(value) && value >= 1 ? value : DEFAULT_LOW_STOCK;
  } catch { return DEFAULT_LOW_STOCK; }
}

export function setLowStockThreshold(value: number) {
  try { localStorage.setItem(KEY, String(value)); } catch { /* storage unavailable; keep the default */ }
  listeners.forEach((listener) => listener());
}

export function useLowStockThreshold() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
  }, read, () => DEFAULT_LOW_STOCK);
}
