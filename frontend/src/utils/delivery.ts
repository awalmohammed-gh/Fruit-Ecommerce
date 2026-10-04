import type { DeliveryStatus, TransportType } from "../types";
import type { ApplicationStatus, Availability, IdType } from "../frontApisRoute/delivery";

// Labels shared by the application form, the partner portal and the admin delivery screens.
export const TRANSPORT_LABEL: Record<TransportType, string> = { motorbike: "Motorbike", bicycle: "Bicycle", car: "Car", van: "Van", other: "Other" };
export const ID_LABEL: Record<IdType, string> = { "ghana-card": "Ghana Card", passport: "Passport", "voter-id": "Voter ID", "drivers-license": "Driver's licence" };
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  "full-time": "Full-time", weekdays: "Weekdays", weekends: "Weekends", evenings: "Evenings", flexible: "Flexible / on call",
};
// Same rule as the API: motorised transport needs a registration and a licence.
export const isMotorised = (transport: string) => transport === "motorbike" || transport === "car" || transport === "van";

// The one action that moves each open delivery forward.
export const NEXT_ACTION: Partial<Record<DeliveryStatus, { label: string; next: "Accepted" | "Picked Up" | "On The Way" | "Delivered" }>> = {
  Assigned: { label: "Accept Delivery", next: "Accepted" },
  Accepted: { label: "Mark as Picked Up", next: "Picked Up" },
  "Picked Up": { label: "Start Delivery", next: "On The Way" },
  "On The Way": { label: "Mark as Delivered", next: "Delivered" },
};
export const FINISHED_STATUSES: DeliveryStatus[] = ["Delivered", "Failed Delivery", "Declined", "Reassigned", "Cancelled"];

// Storefront (Tailwind) colours for delivery and application statuses.
// Few colours on purpose: waiting (amber), moving (GreenFarm orange), done (green), problem (red), closed (grey).
export const deliveryStatusClass: Record<DeliveryStatus, string> = {
  Assigned: "bg-amber-50 text-amber-800 ring-amber-200",
  Accepted: "bg-orange-50 text-app-orange-dark ring-orange-200",
  "Picked Up": "bg-orange-50 text-app-orange-dark ring-orange-200",
  "On The Way": "bg-orange-50 text-app-orange-dark ring-orange-200",
  Delivered: "bg-green-50 text-green-700 ring-green-200",
  "Failed Delivery": "bg-red-50 text-red-700 ring-red-200",
  Declined: "bg-red-50 text-red-700 ring-red-200",
  Reassigned: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  Cancelled: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};
// Shorter names on badges.
export const deliveryStatusLabel = (status: DeliveryStatus) => (status === "Failed Delivery" ? "Failed" : status);

// Which delivery to handle first: the one already on the road, then picked up, then accepted, then new ones (oldest first).
const URGENCY: Partial<Record<DeliveryStatus, number>> = { "On The Way": 0, "Picked Up": 1, Accepted: 2, Assigned: 3 };
export const byUrgency = <T extends { status: DeliveryStatus; assignedAt: string }>(a: T, b: T) =>
  (URGENCY[a.status] ?? 9) - (URGENCY[b.status] ?? 9) || a.assignedAt.localeCompare(b.assignedAt);
export const applicationStatusClass: Record<ApplicationStatus, string> = {
  Pending: "bg-amber-50 text-amber-800 ring-amber-200",
  Approved: "bg-green-50 text-green-700 ring-green-200",
  Rejected: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  Suspended: "bg-red-50 text-red-700 ring-red-200",
};

export const ageFrom = (dateOfBirth: string) => {
  const born = new Date(dateOfBirth);
  const now = new Date();
  return now.getUTCFullYear() - born.getUTCFullYear() - (now < new Date(Date.UTC(now.getUTCFullYear(), born.getUTCMonth(), born.getUTCDate())) ? 1 : 0);
};
export const time = (value: string) => new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const shortDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const cedis = (value: number) => value.toLocaleString("en-GH", { style: "currency", currency: "GHS" });
