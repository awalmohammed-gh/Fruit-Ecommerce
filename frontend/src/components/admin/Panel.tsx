import type { ReactNode } from "react";
import ui from "./ui.module.css";

interface PanelProps {
  title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode;
  /** Content runs edge to edge (tables, toolbars) instead of being padded. */
  flush?: boolean; id?: string; className?: string;
}

export default function Panel({ title, description, actions, children, flush, id, className = "" }: PanelProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} className={`${ui.panel} ${flush ? ui.panelFlush : ""} ${className}`} aria-labelledby={headingId}>
      {title && (
        <div className={ui.panelHeader}>
          <div>
            <h2 id={headingId} className={ui.panelTitle}>{title}</h2>
            {description && <p className={ui.panelDescription}>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {flush ? children : <div className={ui.panelBody}>{children}</div>}
    </section>
  );
}
