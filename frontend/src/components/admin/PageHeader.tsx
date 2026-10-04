import type { ReactNode } from "react";
import ui from "./ui.module.css";

interface PageHeaderProps { title: string; description: string; count?: string; actions?: ReactNode }

// Every admin screen opens with this: title, one-line purpose, actions on the right.
export default function PageHeader({ title, description, count, actions }: PageHeaderProps) {
  return (
    <header className={ui.pageHeader}>
      <div>
        <div className={ui.pageTitleRow}>
          <h1 className={ui.pageTitle}>{title}</h1>
          {count && <span className={ui.countChip}>{count}</span>}
        </div>
        <p className={ui.pageDescription}>{description}</p>
      </div>
      {actions && <div className={ui.pageActions}>{actions}</div>}
    </header>
  );
}
