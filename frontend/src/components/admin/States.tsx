import type { ReactNode } from "react";
import { AlertCircleIcon, InfoIcon, InboxIcon, LoaderCircleIcon, type LucideIcon } from "lucide-react";
import ui from "./ui.module.css";

interface EmptyStateProps { icon?: LucideIcon; title: string; text?: ReactNode; action?: ReactNode }

export function EmptyState({ icon: Icon = InboxIcon, title, text, action }: EmptyStateProps) {
  return (
    <div className={ui.state}>
      <span className={ui.stateIcon}><Icon aria-hidden="true" /></span>
      <p className={ui.stateTitle}>{title}</p>
      {text && <p className={ui.stateText}>{text}</p>}
      {action && <div className={ui.stateAction}>{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={ui.state} role="alert">
      <span className={`${ui.stateIcon} ${ui.stateIconError}`}><AlertCircleIcon aria-hidden="true" /></span>
      <p className={ui.stateTitle}>Couldn't load this data</p>
      <p className={ui.stateText}>{message}</p>
      {onRetry && (
        <div className={ui.stateAction}>
          <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={onRetry}>Try again</button>
        </div>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className={ui.state} role="status">
      <span className={ui.stateIcon}><LoaderCircleIcon className={ui.spin} aria-hidden="true" /></span>
      <p className={ui.stateText}>{label}…</p>
    </div>
  );
}

export function Notice({ tone = "warning", children }: { tone?: "warning" | "info" | "error"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircleIcon : InfoIcon;
  const className = tone === "info" ? ui.noticeInfo : tone === "error" ? ui.noticeError : "";
  return <div className={`${ui.notice} ${className}`} role={tone === "error" ? "alert" : undefined}><Icon aria-hidden="true" /><div>{children}</div></div>;
}
