import type { ReactNode } from "react";
import { orderStage, STAGE_LABEL, type OrderStage } from "../../pages/admin/lib/orders";
import { stockLabel, stockState } from "../../pages/admin/lib/stock";
import type { DeliveryStatus } from "../../types";
import type { ApplicationStatus } from "../../frontApisRoute/delivery";
import ui from "./ui.module.css";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "deal";
const toneClass: Record<Tone, string> = {
  success: ui.toneSuccess, warning: ui.toneWarning, danger: ui.toneDanger,
  info: ui.toneInfo, neutral: ui.toneNeutral, deal: ui.toneDeal,
};

export default function Badge({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`${ui.badge} ${toneClass[tone]}`}>{dot && <span className={ui.badgeDot} aria-hidden="true" />}{children}</span>;
}

// One mapping for every screen, so a status always looks the same.
const stageTone: Record<OrderStage, Tone> = { pending: "warning", processing: "info", completed: "success", cancelled: "danger" };

export function OrderStatusBadge({ status }: { status: string }) {
  const stage = orderStage(status);
  return <Badge tone={stageTone[stage]}>{status === STAGE_LABEL[stage] ? status : `${STAGE_LABEL[stage]} · ${status}`}</Badge>;
}

export function PaymentBadge({ paid }: { paid: boolean }) {
  return <Badge tone={paid ? "success" : "neutral"}>{paid ? "Paid" : "Unpaid"}</Badge>;
}

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  const state = stockState(stock, threshold);
  return <Badge tone={state === "in" ? "success" : state === "low" ? "warning" : "danger"}>{stockLabel[state]}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>;
}

const deliveryTone: Record<DeliveryStatus, Tone> = {
  Assigned: "warning", Accepted: "info", "Picked Up": "info", "On The Way": "info", Delivered: "success",
  "Failed Delivery": "danger", Declined: "danger", Reassigned: "neutral", Cancelled: "neutral",
};
export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <Badge tone={deliveryTone[status]}>{status}</Badge>;
}

const applicationTone: Record<ApplicationStatus, Tone> = { Pending: "warning", Approved: "success", Rejected: "neutral", Suspended: "danger" };
// An approved applicant who hasn't set their password yet can't sign in, so they aren't "Active" yet.
export function ApplicationStatusBadge({ status, activated = true }: { status: ApplicationStatus; activated?: boolean }) {
  if (status === "Approved" && !activated) return <Badge tone="info">Awaiting activation</Badge>;
  return <Badge tone={applicationTone[status]}>{status === "Approved" ? "Active" : status}</Badge>;
}
