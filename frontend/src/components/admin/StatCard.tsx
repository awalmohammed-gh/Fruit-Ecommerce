import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon, type LucideIcon } from "lucide-react";
import ui from "./ui.module.css";

interface StatCardProps {
  label: string; value: ReactNode; icon: LucideIcon; to?: string;
  /** Percentage change vs the previous period; null when there's nothing to compare. */
  delta?: number | null; deltaLabel?: string; note?: ReactNode;
  tone?: "default" | "warning" | "danger";
}

export function Delta({ value }: { value: number }) {
  const [className, Icon] = value > 0 ? [ui.deltaUp, ArrowUpRightIcon] : value < 0 ? [ui.deltaDown, ArrowDownRightIcon] : [ui.deltaFlat, MinusIcon];
  return <span className={`${ui.delta} ${className}`}><Icon aria-hidden="true" />{value > 0 ? "+" : ""}{value}%</span>;
}

export default function StatCard({ label, value, icon: Icon, to, delta, deltaLabel, note, tone = "default" }: StatCardProps) {
  const iconTone = tone === "warning" ? ui.statIconWarning : tone === "danger" ? ui.statIconDanger : "";
  const body = (
    <>
      <div className={ui.statTop}>
        <span className={ui.statLabel}>{label}</span>
        <span className={`${ui.statIcon} ${iconTone}`}><Icon aria-hidden="true" /></span>
      </div>
      <p className={ui.statValue}>{value}</p>
      <div className={ui.statFoot}>
        {typeof delta === "number" && <Delta value={delta} />}
        {typeof delta === "number" && deltaLabel && <span>{deltaLabel}</span>}
        {note && <span>{note}</span>}
      </div>
    </>
  );
  return to ? <Link to={to} className={ui.stat}>{body}</Link> : <div className={ui.stat}>{body}</div>;
}

interface MiniStatProps { label: string; value: ReactNode; note?: string; dot?: "success" | "warning" | "danger" | "info" | "neutral"; to?: string }
const dotClass = { success: ui.dotSuccess, warning: ui.dotWarning, danger: ui.dotDanger, info: ui.dotInfo, neutral: ui.dotNeutral };

// Secondary figures: smaller than the stat cards so they don't compete with them.
export function MiniStat({ label, value, note, dot, to }: MiniStatProps) {
  const body = (
    <>
      <span className={ui.miniLabel}>{dot && <span className={`${ui.dot} ${dotClass[dot]}`} aria-hidden="true" />}{label}</span>
      <span className={ui.miniValue}>{value}</span>
      {note && <span className={ui.miniNote}>{note}</span>}
    </>
  );
  return to ? <Link to={to} className={ui.mini}>{body}</Link> : <div className={ui.mini}>{body}</div>;
}

export function MiniStatRow({ children }: { children: ReactNode }) {
  return <div className={ui.miniGrid}>{children}</div>;
}
