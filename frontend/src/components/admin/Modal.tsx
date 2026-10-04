import { useEffect, useId, useRef, type ReactNode } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import ui from "./ui.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** While true, Escape and backdrop clicks don't close the modal (a save is in flight). */
  busy?: boolean;
}

// Built on <dialog>, so focus trapping, Escape and the backdrop come from the browser.
export default function Modal({ open, onClose, title, description, children, footer, wide, busy = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${ui.modal} ${wide ? ui.modalWide : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      {open && (
        <>
          <div className={ui.modalHeader}>
            <div>
              <h2 id={titleId} className={ui.modalTitle}>{title}</h2>
              {description && <p className={ui.modalDescription}>{description}</p>}
            </div>
            <button type="button" className={ui.iconButton} onClick={onClose} disabled={busy} aria-label="Close">
              <XIcon aria-hidden="true" />
            </button>
          </div>
          {children && <div className={ui.modalBody}>{children}</div>}
          {footer && <div className={ui.modalFooter}>{footer}</div>}
        </>
      )}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Required before anything permanent or disruptive (deletes, deactivations).
export function ConfirmDialog({ open, title, message, confirmLabel, tone = "danger", busy = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      footer={
        <>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={`${ui.button} ${tone === "danger" ? ui.danger : ui.primary}`} onClick={onConfirm} disabled={busy}>
            {busy && <LoaderCircleIcon className={ui.spin} aria-hidden="true" />}{confirmLabel}
          </button>
        </>
      }
    >
      <div className={ui.hint} style={{ fontSize: 13.5, color: "var(--gf-text)" }}>{message}</div>
    </Modal>
  );
}
