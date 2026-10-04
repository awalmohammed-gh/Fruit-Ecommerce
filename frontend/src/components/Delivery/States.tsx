import type { LucideIcon } from "lucide-react";

// Empty, error and loading states for the driver workspace, in the storefront card style.
export function EmptyCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="text-center py-12 px-6 bg-white rounded-2xl border border-app-border/60">
      <span className="size-14 bg-app-cream rounded-full flex-center mx-auto mb-3"><Icon className="size-7 text-app-text-light" aria-hidden="true" /></span>
      <p className="font-semibold text-zinc-800">{title}</p>
      <p className="text-sm text-app-text-light mt-1 max-w-sm mx-auto">{text}</p>
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="text-center py-12 px-6 bg-white rounded-2xl border border-app-border/60">
      <p className="font-semibold text-zinc-800">Couldn't load this</p>
      <p className="text-sm text-app-text-light mt-1 mb-4">{message}</p>
      <button type="button" onClick={onRetry} className="px-5 py-2.5 bg-app-green text-white text-sm font-medium rounded-xl">Try again</button>
    </div>
  );
}

export function LoadingCards({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => <div key={index} className="h-48 bg-white rounded-2xl border border-app-border/60 animate-pulse" />)}
    </div>
  );
}
