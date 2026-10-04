import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { EllipsisIcon, type LucideIcon } from "lucide-react";
import ui from "./ui.module.css";

export interface MenuAction {
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  to?: string;
  danger?: boolean;
  /** Draws a divider above this item (used to separate destructive actions). */
  separated?: boolean;
}

// Row actions. The menu is position: fixed so table scroll containers can't clip it.
export default function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const close = () => setPosition(null);
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setPosition(null);
    const rect = button.current!.getBoundingClientRect();
    const menuHeight = actions.length * 40 + 16;
    const top = rect.bottom + 6 + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6;
    setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) });
  };

  const closeAndFocus = () => { setPosition(null); button.current?.focus(); };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") { event.preventDefault(); closeAndFocus(); }
    if (event.key === "Tab") setPosition(null);
    if (event.key === "ArrowDown") { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
  };

  return (
    <>
      <button ref={button} type="button" className={ui.iconButton} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}>
        <EllipsisIcon aria-hidden="true" />
      </button>
      {open && (
        <div ref={menu} id={id} role="menu" aria-label={label} className={ui.menu} style={position} onKeyDown={onKeyDown}>
          {actions.map((action) => {
            const className = `${ui.menuItem} ${action.danger ? ui.menuDanger : ""}`;
            const content = <><action.icon aria-hidden="true" />{action.label}</>;
            return (
              <Fragment key={action.label}>
                {action.separated && <div className={ui.menuDivider} role="separator" />}
                {action.to
                  ? <Link role="menuitem" to={action.to} className={className} onClick={() => setPosition(null)}>{content}</Link>
                  : <button role="menuitem" type="button" className={className} onClick={() => { setPosition(null); action.onSelect?.(); }}>{content}</button>}
              </Fragment>
            );
          })}
        </div>
      )}
    </>
  );
}
