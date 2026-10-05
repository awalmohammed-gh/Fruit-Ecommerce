import { useNavigate } from "react-router-dom";
import { usePricing } from "../../hooks/usePricing";
import { useEffect, useRef } from "react";
import { useCart } from "../../context/CartContext";
import { maxQuantity } from "../../utils/orderLimits";
import {
  ArrowRightIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBag,
  ShoppingBagIcon,
  TrashIcon,
  TruckIcon,
  XIcon,
} from "lucide-react";

const CartModal = () => {
  const {
    items,
    updateQuantity,
    removeFromCart,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    saving,
    error,
    refresh,
  } = useCart();
  const navigate = useNavigate();
  const { pricing, estimate } = usePricing();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isCartOpen || !dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isCartOpen]);

  // An estimate from the server's pricing rules; checkout confirms the exact amounts.
  const totals = estimate(cartTotal);
  const deliveryFee = totals?.deliveryFee ?? 0;

  return (
      <dialog
        ref={dialogRef}
        aria-labelledby="cart-modal-title"
        onClose={() => setIsCartOpen(false)}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setIsCartOpen(false);
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] border-0 p-0 rounded-3xl bg-white text-app-text shadow-2xl overflow-hidden open:flex flex-col backdrop:bg-black/45 backdrop:backdrop-blur-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-app-border bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-app-green/10 rounded-full">
              <ShoppingBag className="size-5 text-app-green" />
            </div>
            <h2 id="cart-modal-title" className="font-serif text-2xl text-app-green">Your Cart</h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-app-orange text-white rounded-full">
              {items.length} {items.length > 1 ? "items" : "item"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setIsCartOpen(false)}
            className="size-11 flex-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <XIcon className="size-5 text-gray-500" />
          </button>
        </div>

        {/* Items Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 overscroll-contain">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={refresh} disabled={saving} className="font-semibold underline">Retry</button></p>}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-4 bg-gray-50 rounded-full mb-4">
                <ShoppingBagIcon className="size-16 text-app-border" />
              </div>
              <p className="text-lg font-semibold text-gray-800 mb-1">
                Your cart is empty
              </p>
              <p className="text-sm text-app-text-light mb-6">
                Looks like you haven't added any items yet
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="px-6 py-2.5 bg-app-green text-white rounded-xl hover:bg-green-800 transition-all duration-300"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                className="flex gap-3 bg-linear-to-r from-app-cream/50 to-app-cream/30 rounded-xl p-3 hover:shadow-md transition-all duration-300 group"
                key={item.product._id}
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="size-16 rounded-lg object-cover shrink-0 shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate group-hover:text-app-green transition-colors duration-300">
                    {item.product.name}
                  </h3>
                  <p className="text-xs text-app-text-light mt-0.5">
                    {item.product.price.toLocaleString("en-GH", {
                      style: "currency",
                      currency: "GHS",
                    })}{" "}
                    / {item.product.unit}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={saving}
                        aria-label={`Decrease quantity of ${item.product.name}`}
                        className="size-7 rounded-lg bg-white border border-app-border flex-center hover:bg-app-green hover:border-app-green hover:text-white transition-all duration-300 active:scale-95"
                        onClick={() =>
                          updateQuantity(item.product._id, item.quantity - 1)
                        }
                      >
                        <MinusIcon className="size-3" />
                      </button>
                      <span className="text-sm font-semibold text-gray-800 w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.product.name}`}
                        disabled={saving || item.quantity >= maxQuantity(item.product)}
                        className="size-7 rounded-lg bg-white border border-app-border flex-center hover:bg-app-green hover:border-app-green hover:text-white transition-all duration-300 active:scale-95"
                        onClick={() =>
                          updateQuantity(item.product._id, item.quantity + 1)
                        }
                      >
                        <PlusIcon className="size-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-app-orange">
                        {(item.product.price * item.quantity).toLocaleString(
                          "en-GH",
                          {
                            style: "currency",
                            currency: "GHS",
                          },
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={saving}
                        aria-label={`Remove ${item.product.name} from cart`}
                        onClick={() => removeFromCart(item.product._id)}
                        className="p-1.5 text-app-text-light hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-300"
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 sm:p-6 border-t border-app-border bg-white shrink-0">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-app-text-light">Subtotal</span>
                <span className="font-semibold text-gray-800">
                  {cartTotal.toLocaleString("en-GH", {
                    style: "currency",
                    currency: "GHS",
                  })}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-app-text-light">Delivery Fee</span>
                <span className="font-semibold">
                  {!totals ? (
                    <span className="text-app-text-light text-xs">At checkout</span>
                  ) : deliveryFee === 0 ? (
                    <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs">
                      Free
                    </span>
                  ) : (
                    <span className="text-gray-800">
                      {deliveryFee.toLocaleString("en-GH", {
                        style: "currency",
                        currency: "GHS",
                      })}
                    </span>
                  )}
                </span>
              </div>

              {totals && (
                <div className="flex justify-between text-sm">
                  <span className="text-app-text-light">Tax ({Math.round((pricing?.taxRate ?? 0) * 100)}%)</span>
                  <span className="font-semibold text-gray-800">
                    {totals.tax.toLocaleString("en-GH", { style: "currency", currency: "GHS" })}
                  </span>
                </div>
              )}

              {totals && deliveryFee > 0 && (
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-orange-600  flex items-center gap-2">
                    <TruckIcon className="size-4"/> Add GHS {totals.toFreeDelivery.toFixed(2)} more
                    for free delivery
                  </p>
                </div>
              )}

              <div className="flex justify-between text-base font-bold pt-3 border-t border-app-border">
                <span className="text-gray-800">Total</span>
                <span className="text-app-orange text-lg">
                  {(totals?.total ?? cartTotal).toLocaleString("en-GH", {
                    style: "currency",
                    currency: "GHS",
                  })}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate("/cart");
                  window.scrollTo(0, 0);
                }}
                className="w-full py-3 border border-app-green/20 text-app-green font-semibold rounded-xl hover:bg-green-50 flex-center gap-2"
              >
                View full cart
                <ShoppingBagIcon className="size-4" aria-hidden="true" />
              </button>

              <button
                onClick={() => {
                  setIsCartOpen(false);
                  navigate("/checkout");
                  window.scrollTo(0, 0);
                }}
                className="w-full py-3.5 bg-app-orange text-white font-semibold rounded-xl hover:bg-orange-600 transition-all duration-300 flex-center gap-2 active:scale-[0.98] shadow-lg hover:shadow-xl group"
              >
                Proceed to Checkout
                <ArrowRightIcon className="size-4 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            </div>
          </div>
        )}
      </dialog>
  );
};

export default CartModal;
