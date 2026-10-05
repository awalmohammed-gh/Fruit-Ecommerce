import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import toast from "../components/toast/toast";
import { cartApi, type CartResponse } from "../frontApisRoute/cart";
import type { CartItem, Product } from "../types";
import { MAX_PER_PRODUCT } from "../utils/orderLimits";
import { useCustomerAuth } from "./CustomerAuthContext";

/** An Add to Cart pressed while signed out, waiting for sign-in on the same page. */
export interface PendingCartAdd { product: Product; quantity: number; from: string }
interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => Promise<void>;
  reloadCart: () => Promise<void>;
  cartCount: number;
  cartTotal: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  applyQuote: (lines: { product: string; price: number; originalPrice: number; stock: number }[]) => void;
  pendingAdd: PendingCartAdd | null;
  completePendingAdd: () => void;
  cancelPendingAdd: () => void;
}
interface Snapshot { owner: string | null; items: CartItem[]; loaded: boolean; error: string | null }
const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useCustomerAuth();
  const owner = user?._id ?? null;
  const [snapshot, setSnapshot] = useState<Snapshot>({ owner: null, items: [], loaded: false, error: null });
  const [busy, setBusy] = useState({ owner, count: 0 });
  const [attempt, setAttempt] = useState(0);
  const [modal, setModal] = useState({ owner, open: false });
  const setIsCartOpen = useCallback((open: boolean) => setModal({ owner, open }), [owner]);
  const pendingRef = useRef<PendingCartAdd | null>(null);
  const [pendingAdd, setPendingAdd] = useState<PendingCartAdd | null>(null);
  const session = useRef({ owner, generation: 0 });
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Invalidate queued work and late responses before any passive effects run for a new account.
  useLayoutEffect(() => {
    session.current = { owner, generation: session.current.generation + 1 };
    return () => { session.current = { owner: null, generation: session.current.generation + 1 }; };
  }, [owner]);

  // Serialize reads and writes so cart restoration cannot overwrite a just-added product.
  const enqueue = useCallback((request: (id: string) => Promise<CartResponse>, success?: () => void) => {
    if (!owner) return Promise.resolve();
    const generation = session.current.generation;
    const current = () => session.current.owner === owner && session.current.generation === generation;
    const task = queue.current.catch(() => {}).then(async () => {
      if (!current()) return;
      setBusy({ owner, count: 1 });
      try {
        const result = await request(owner);
        if (!current() || result.ownerId !== owner) return;
        setSnapshot({ owner, items: result.items, loaded: true, error: null });
        success?.();
      } catch (failure) {
        if (!current()) return;
        const message = failure instanceof Error ? failure.message : "Unable to update your cart";
        setSnapshot((previous) => ({ owner, items: previous.owner === owner ? previous.items : [], loaded: true, error: message }));
        throw failure;
      }
    }).finally(() => {
      if (current()) setBusy((previous) => ({ owner, count: Math.max(0, previous.count - 1) }));
    });
    queue.current = task;
    return task;
  }, [owner]);

  useEffect(() => {
    if (owner) void enqueue(cartApi.list).catch(() => { /* Display the load error with a retry. */ });
  }, [owner, attempt, enqueue]);

  const notifyFailure = (failure: unknown) => toast.error(failure instanceof Error ? failure.message : "Unable to update your cart");
  const putInCart = useCallback((product: Product, quantity: number) => {
    void enqueue((id) => cartApi.add(id, product._id, Math.min(quantity, MAX_PER_PRODUCT)), () => {
      setIsCartOpen(true);
      toast.success(`${product.name} added to cart`, { duration: 2500 });
    }).catch(notifyFailure);
  }, [enqueue, setIsCartOpen]);
  const keepPending = useCallback((next: PendingCartAdd | null) => { pendingRef.current = next; setPendingAdd(next); }, []);
  const addToCart = useCallback((product: Product, quantity = 1) => {
    if (owner) putInCart(product, quantity);
    else keepPending({ product, quantity, from: window.location.pathname + window.location.search + window.location.hash });
  }, [owner, putInCart, keepPending]);
  const completePendingAdd = useCallback(() => {
    const next = pendingRef.current;
    if (!owner || !next) return;
    keepPending(null);
    putInCart(next.product, next.quantity);
  }, [owner, keepPending, putInCart]);
  const cancelPendingAdd = useCallback(() => keepPending(null), [keepPending]);
  const removeFromCart = (productId: string) => {
    void enqueue((id) => cartApi.remove(id, productId), () => toast.info("Item removed from cart", { duration: 2500 })).catch(notifyFailure);
  };
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) return removeFromCart(productId);
    void enqueue((id) => cartApi.update(id, productId, Math.min(quantity, MAX_PER_PRODUCT))).catch(notifyFailure);
  };
  const clearCart = async () => {
    await enqueue(cartApi.clear, () => setIsCartOpen(false));
  };
  const reloadCart = () => enqueue(cartApi.list, () => setIsCartOpen(false));
  // Quote data is a temporary display update; only product IDs and quantities are persisted on the server.
  const applyQuote = useCallback((lines: { product: string; price: number; originalPrice: number; stock: number }[]) => {
    setSnapshot((previous) => {
      if (previous.owner !== owner) return previous;
      let changed = false;
      const items = previous.items.map((item) => {
        const line = lines.find((entry) => entry.product === item.product._id);
        if (!line || (line.price === item.product.price && line.originalPrice === item.product.originalPrice && line.stock === item.product.stock)) return item;
        changed = true;
        const discount = line.originalPrice > line.price ? Math.round(((line.originalPrice - line.price) / line.originalPrice) * 100) : 0;
        return { ...item, product: { ...item.product, price: line.price, originalPrice: line.originalPrice, stock: line.stock, discount } };
      });
      return changed ? { ...previous, items } : previous;
    });
  }, [owner]);

  // Never render another account's snapshot, including the first render immediately after sign-out.
  const items = owner && snapshot.owner === owner ? snapshot.items : [];
  const loading = authLoading || (!!owner && (snapshot.owner !== owner || !snapshot.loaded));
  const saving = busy.owner === owner && busy.count > 0;
  const error = owner && snapshot.owner === owner ? snapshot.error : null;
  return <CartContext.Provider value={{
    items, addToCart, removeFromCart, updateQuantity, clearCart, reloadCart,
    cartCount: items.reduce((sum, item) => sum + item.quantity, 0),
    cartTotal: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    loading, saving, error, refresh: () => setAttempt((value) => value + 1),
    isCartOpen: !!owner && modal.owner === owner && modal.open, setIsCartOpen, applyQuote,
    pendingAdd, completePendingAdd, cancelPendingAdd,
  }}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
