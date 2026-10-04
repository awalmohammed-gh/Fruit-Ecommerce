/**
 * GreenFarm toasts.
 *
 *   import toast from "../components/toast/toast";
 *   toast.success("Address saved");
 *   toast.error("Couldn't save the address", { description: "Check your connection and try again." });
 *   toast.warning(message, { duration: 6000 });
 *
 * A tiny store outside React: any code can raise a toast, and <Toaster /> (rendered once in App) shows them.
 */
export type ToastType = "success" | "error" | "warning" | "info";
export interface ToastOptions { description?: string; duration?: number }
export interface ToastItem { id: number; type: ToastType; message: string; description?: string; duration: number; leaving: boolean }

// Errors stay longest so there's time to read them.
const DURATION: Record<ToastType, number> = { success: 3500, info: 4000, warning: 4500, error: 5000 };
const MAX_VISIBLE = 4;
export const EXIT_MS = 180; // matches the exit animation in index.css

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function publish(next: ToastItem[]) {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getToasts = () => toasts;

/** Plays the exit animation, then removes the toast. */
export function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (!toasts.some((item) => item.id === id && !item.leaving)) return;
  publish(toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
  setTimeout(() => publish(toasts.filter((item) => item.id !== id)), EXIT_MS);
}

function show(type: ToastType, message: string, options: ToastOptions = {}) {
  const id = nextId++;
  const duration = options.duration ?? DURATION[type];
  // Newest first. Beyond the limit, the oldest goes straight away so the stack never grows off-screen.
  const kept = toasts.filter((item) => !item.leaving).slice(0, MAX_VISIBLE - 1);
  for (const item of toasts) if (!kept.includes(item)) { clearTimeout(timers.get(item.id)); timers.delete(item.id); }
  publish([{ id, type, message, description: options.description, duration, leaving: false }, ...kept]);
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration));
  return id;
}

/** The message to show for a failed request: the server's own message when it sent one, otherwise `fallback`. */
export const errorMessage = (error: unknown, fallback = "Something went wrong. Please try again.") =>
  error instanceof Error && error.message ? error.message : fallback;

const toast = {
  success: (message: string, options?: ToastOptions) => show("success", message, options),
  error: (message: string, options?: ToastOptions) => show("error", message, options),
  warning: (message: string, options?: ToastOptions) => show("warning", message, options),
  info: (message: string, options?: ToastOptions) => show("info", message, options),
  dismiss,
};
export default toast;
