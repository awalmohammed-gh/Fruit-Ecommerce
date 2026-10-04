import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";

interface Props {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Modal for the delivery portal. A native <dialog>, so focus trapping and Escape come from the browser.
export default function PortalDialog({ title, description, children, confirmLabel, tone = "primary", busy, disabled, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && !disabled) onConfirm();
  };

  return (
    <dialog ref={ref} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      className="m-auto w-full max-w-md bg-transparent p-4 backdrop:bg-black/50 backdrop:backdrop-blur-sm">
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 id={titleId} className={`text-lg font-semibold ${tone === "danger" ? "text-red-700" : "text-app-green"}`}>{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1.5 -m-1.5 rounded-full text-zinc-500 hover:bg-app-cream"><XIcon className="size-5" /></button>
        </div>
        {description && <div className="text-sm text-zinc-600 mb-5">{description}</div>}
        {children}
        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 h-12 text-sm font-semibold text-zinc-700 bg-zinc-100 rounded-xl hover:bg-zinc-200">Back</button>
          <button type="submit" disabled={busy || disabled} className={`flex-1 h-12 text-sm font-semibold text-white rounded-xl flex-center gap-2 disabled:opacity-50 ${tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-app-green hover:bg-app-green-light"}`}>
            {busy && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}{confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
