import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShoppingBag, XIcon } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import CustomerAuthForm from "./CustomerAuthForm";

// Asks a signed-out shopper to sign in when they press Add to Cart, without leaving the page they're on
// (route, filters, search and scroll position all stay put), then adds the item they picked.
export default function CartSignInDialog() {
  const { pendingAdd, completePendingAdd, cancelPendingAdd } = useCart();
  const { user } = useCustomerAuth();
  const location = useLocation();
  const here = location.pathname + location.search + location.hash;
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = !!pendingAdd && !user && pendingAdd.from === here;

  // Signed in (with this form, in another tab, or a session check that was still loading): add the waiting item.
  // Left the page instead (e.g. with the back button): drop it, so it's never added somewhere unexpected.
  useEffect(() => {
    if (!pendingAdd) return;
    if (pendingAdd.from !== here) cancelPendingAdd();
    else if (user) completePendingAdd();
  }, [pendingAdd, here, user, cancelPendingAdd, completePendingAdd]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  // Closing without signing in forgets the item. Not while a sign-in is on its way.
  const close = () => { if (!busy) cancelPendingAdd(); };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cart-sign-in-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] border-0 p-0 rounded-3xl bg-app-cream text-app-text shadow-2xl overflow-y-auto backdrop:bg-black/45 backdrop:backdrop-blur-sm"
    >
      {open && pendingAdd && (
        <div className="relative px-5 py-8 sm:px-8">
          <button
            type="button"
            aria-label="Close sign in"
            onClick={close}
            disabled={busy}
            className="absolute top-3 right-3 size-11 flex-center rounded-full hover:bg-white transition-colors disabled:opacity-40"
          >
            <XIcon className="size-5" />
          </button>
          <CustomerAuthForm
            heading="h2"
            headingId="cart-sign-in-title"
            onBusyChange={setBusy}
            notice={
              <div role="status" className="mb-6 flex items-start gap-3 rounded-xl bg-app-green/10 p-3 text-sm text-app-green">
                <ShoppingBag className="size-5 shrink-0" aria-hidden="true" />
                <p>
                  <span className="font-semibold">Please sign in to add items to your cart.</span>{" "}
                  {pendingAdd.product.name} will be added as soon as you're signed in.
                </p>
              </div>
            }
          />
        </div>
      )}
    </dialog>
  );
}
