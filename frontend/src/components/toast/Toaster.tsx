import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon, type LucideIcon } from "lucide-react";
import { dismiss, getToasts, subscribe, type ToastItem, type ToastType } from "./toast";

// Each type has its own icon, accent and spoken label, so colour is never the only cue.
const LOOK: Record<ToastType, { icon: LucideIcon; label: string; accent: string; iconClass: string }> = {
  success: { icon: CircleCheckIcon, label: "Success", accent: "bg-app-green", iconClass: "text-app-green bg-app-green/10" },
  error: { icon: CircleAlertIcon, label: "Error", accent: "bg-app-error", iconClass: "text-red-700 bg-red-50" },
  warning: { icon: TriangleAlertIcon, label: "Warning", accent: "bg-app-warning", iconClass: "text-amber-700 bg-amber-50" },
  info: { icon: InfoIcon, label: "Info", accent: "bg-app-text-light", iconClass: "text-app-green bg-app-cream" },
};

function Toast({ item }: { item: ToastItem }) {
  const look = LOOK[item.type];
  const Icon = look.icon;
  // Errors and warnings interrupt the screen reader; success and info wait for a pause.
  const urgent = item.type === "error" || item.type === "warning";
  return (
    <div role={urgent ? "alert" : "status"} aria-live={urgent ? "assertive" : "polite"} aria-atomic="true" data-toast-type={item.type}
      className={`gf-toast ${item.leaving ? "gf-toast-leave" : ""} pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-app-border bg-white py-3 pl-4 pr-2 shadow-lg shadow-app-green/10`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${look.accent}`} aria-hidden="true" />
      <span className={`mt-0.5 size-8 shrink-0 rounded-full flex-center ${look.iconClass}`}><Icon className="size-4.5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold text-app-text wrap-break-word"><span className="sr-only">{look.label}: </span>{item.message}</p>
        {item.description && <p className="mt-0.5 text-sm text-app-text-light wrap-break-word">{item.description}</p>}
      </div>
      <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification"
        className="size-9 shrink-0 rounded-lg flex-center text-app-text-light hover:bg-app-cream hover:text-app-text">
        <XIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// While a modal <dialog> is open (cart, admin modals) the browser makes everything outside it inert, so toasts
// rendered on the page could be seen but not clicked or read out. They're rendered inside the open dialog instead.
function useTopModal() {
  const [modal, setModal] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    const update = () => {
      const open = [...document.querySelectorAll("dialog[open]")].filter((dialog) => dialog.matches(":modal")) as HTMLDialogElement[];
      setModal(open[open.length - 1] ?? null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  return modal;
}

// Admin and driver workspace pages have a fixed header with the account menu and sign-out; toasts sit just below it.
const BELOW_HEADER = /^\/(admin(?!\/login)|delivery-partner\/(dashboard|deliveries|history|profile))/;

/**
 * Where toasts appear. Render once at the app root.
 * Top-right on larger screens, full width (with a margin) on phones. Newest on top.
 */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts);
  const { pathname } = useLocation();
  const modal = useTopModal();
  const top = BELOW_HEADER.test(pathname) ? "top-[4.5rem]" : "top-3 sm:top-4";
  return createPortal(
    <section aria-label="Notifications" className={`pointer-events-none fixed z-100 inset-x-3 ${top} sm:inset-x-auto sm:right-4 sm:w-96`}>
      <div className="flex flex-col gap-2">
        {toasts.map((item) => <Toast key={item.id} item={item} />)}
      </div>
    </section>,
    modal ?? document.body,
  );
}
