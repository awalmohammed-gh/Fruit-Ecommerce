import { DEFAULT_ADMIN_PREFERENCES, type AdminPreferences } from "../../../frontApisRoute/adminSettings";
const count = new Intl.NumberFormat("en-GH");
let preferences = DEFAULT_ADMIN_PREFERENCES;
export function configureAdminFormatting(next: AdminPreferences) { preferences = next; }
const currencyFormat = (compact = false) => new Intl.NumberFormat("en-GH", {
  style: "currency", currency: "GHS", currencyDisplay: preferences.currencyDisplay,
  ...(compact && { notation: "compact" as const, maximumFractionDigits: 1 }),
});

export const money = (value: number) => currencyFormat().format(value);
export const compactMoney = (value: number) => currencyFormat(Math.abs(value) >= 10000).format(value);
// Chart axis ticks: short and without decimals, e.g. GH₵250 or GH₵1.5K.
export const axisMoney = (value: number) => currencyFormat(true).format(value);
export const number = (value: number) => count.format(value);
export const plural = (value: number, noun: string) => `${count.format(value)} ${noun}${value === 1 ? "" : "s"}`;

export function time(value: string | Date) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "?";
  return instant.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: preferences.timeFormat === "12-hour" });
}

export function date(value: string | Date, withTime = false) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const day = part("day"), month = part("month"), year = part("year");
  const formatted = preferences.dateFormat === "YYYY-MM-DD" ? `${year}-${month}-${day}`
    : preferences.dateFormat === "MM/DD/YYYY" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  return withTime ? `${formatted}, ${time(instant)}` : formatted;
}

export function relativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date(value);
}

// Change between two periods as a whole percentage; null when the earlier period had nothing to compare against.
export function change(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
