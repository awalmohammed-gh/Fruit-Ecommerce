import { ApiError, apiRequest } from "./client";
import { toQuery, type Pagination } from "./products";
import type { DeliveryHistoryEntry, DeliveryStatus, OrderAddress, OrderStatus, TransportType } from "../types";

export type IdType = "ghana-card" | "passport" | "voter-id" | "drivers-license";
export type Availability = "full-time" | "weekdays" | "weekends" | "evenings" | "flexible";
export type ApplicationStatus = "Pending" | "Approved" | "Rejected" | "Suspended";

/** A delivery partner account/application, as its owner sees it. Separate from customer accounts. */
export interface PartnerApplication {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  region: string;
  city: string;
  address: string;
  digitalAddress: string;
  transportType: TransportType;
  vehicleType: string;
  vehicleRegistration: string;
  licenseNumber: string;
  idType: IdType;
  idNumber: string;
  emergencyContact: { name: string; phone: string };
  availability: Availability;
  notes: string;
  applicationStatus: ApplicationStatus;
  // Set once an approved applicant chooses a password; only then can they sign in.
  accountActivated: boolean;
  isActive: boolean;
  rejectionReason: string;
  suspensionReason: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  fullName: string; email: string; phone: string; dateOfBirth: string; region: string; city: string; address: string; digitalAddress: string;
  transportType: TransportType | ""; vehicleType: string; vehicleRegistration: string; licenseNumber: string;
  idType: IdType | ""; idNumber: string; emergencyContactName: string; emergencyContactPhone: string; availability: Availability | ""; notes: string;
}
export type PartnerProfileInput = Pick<ApplicationInput, "phone" | "region" | "city" | "address" | "digitalAddress" | "emergencyContactName" | "emergencyContactPhone"> & { availability: Availability };

/** A delivery as the partner carrying it sees it: only what's needed to complete it. */
export interface PartnerDelivery {
  _id: string;
  status: DeliveryStatus;
  assignedAt: string;
  completedAt: string | null;
  notes: string;
  failureReason: string;
  history: DeliveryHistoryEntry[];
  updatedAt: string;
  order: {
    _id: string;
    number: string;
    total: number;
    paymentMethod: "cash";
    isPaid: boolean;
    items: { name: string; unit: string; quantity: number }[];
    recipient: { name: string; phone: string };
    address: { line1: string; line2: string; city: string; region: string; digitalAddress: string; landmark: string };
  } | null;
}
export interface DeliverySummary { assigned: number; inProgress: number; completed: number; today: number }
export interface HistoryQuery { status?: DeliveryStatus | ""; from?: string; to?: string; page?: number }

export const FAILURE_REASONS = ["Customer unreachable", "Wrong or incomplete address", "Customer refused delivery", "Customer asked to reschedule", "Vehicle problem", "Other"] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

// A 403 from the partner endpoints means the account was suspended mid-shift (401s are handled in client.ts).
export const PARTNER_BLOCKED_EVENT = "greenfarm:partner-blocked";
async function partnerRequest<T>(path: string, options?: RequestInit) {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) window.dispatchEvent(new Event(PARTNER_BLOCKED_EVENT));
    throw error;
  }
}
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const delivery = (id: string, action: string) => `/delivery/deliveries/${encodeURIComponent(id)}/${action}`;
type DeliveryResult = { delivery: PartnerDelivery; message: string };

// Delivery partners have their own accounts and session, separate from customers.
// Applying, checking status and activating are public; the email + reference code prove who applied.
export const deliveryApi = {
  apply: (input: ApplicationInput) => apiRequest<{ application: PartnerApplication; reference: string; message: string }>("/delivery/application", json("POST", input)),
  status: (email: string, reference: string) => apiRequest<{ application: PartnerApplication }>("/delivery/application/status", json("POST", { email, reference })),
  activate: (email: string, reference: string, password: string) =>
    apiRequest<{ partner: PartnerApplication; message: string }>("/delivery/activate", json("POST", { email, reference, password })),
  login: (email: string, password: string) => apiRequest<{ partner: PartnerApplication; message: string }>("/delivery/login", json("POST", { email, password })),
  logout: () => apiRequest<{ message: string }>("/delivery/logout", json("POST")),
  // The signed-in partner after a refresh, or null when nobody is signed in.
  me: () => apiRequest<{ partner: PartnerApplication | null }>("/delivery/me"),
  profile: () => partnerRequest<{ partner: PartnerApplication }>("/delivery/profile"),
  updateProfile: (input: PartnerProfileInput) => partnerRequest<{ partner: PartnerApplication; message: string }>("/delivery/profile", json("PATCH", input)),
  summary: () => partnerRequest<{ summary: DeliverySummary }>("/delivery/summary"),
  active: () => partnerRequest<{ deliveries: PartnerDelivery[] }>("/delivery/deliveries"),
  get: (id: string) => partnerRequest<{ delivery: PartnerDelivery }>(`/delivery/deliveries/${encodeURIComponent(id)}`),
  history: (query: HistoryQuery) => partnerRequest<{ deliveries: PartnerDelivery[]; pagination: Pagination }>(`/delivery/deliveries${toQuery({ view: "history", ...query })}`),
  advance: (id: string, status: "Accepted" | "Picked Up" | "On The Way") => partnerRequest<DeliveryResult>(delivery(id, "status"), json("PATCH", { status })),
  decline: (id: string, reason: string) => partnerRequest<DeliveryResult>(delivery(id, "decline"), json("POST", { reason })),
  fail: (id: string, reason: FailureReason, note: string) => partnerRequest<DeliveryResult>(delivery(id, "fail"), json("POST", { reason, note })),
  deliver: (id: string, otp: string) => partnerRequest<DeliveryResult>(delivery(id, "deliver"), json("POST", { otp })),
  location: (id: string, lat: number, lng: number) => partnerRequest<{ message: string }>(delivery(id, "location"), json("PATCH", { lat, lng })),
};

// ---------- Management ----------

export interface ApplicationRow {
  _id: string; fullName: string; email: string; phone: string; region: string; city: string;
  transportType: TransportType; vehicleType: string; applicationStatus: ApplicationStatus; accountActivated: boolean; isActive: boolean;
  createdAt: string; approvedAt: string | null;
}
export interface ApplicationDetail extends PartnerApplication {
  approvedBy: string;
  statusHistory: { status: ApplicationStatus; note: string; by: string; at: string }[];
  activeDeliveries: number;
  completedDeliveries: number;
}
export type PartnerRow = ApplicationRow & { activeDeliveries: number; completedDeliveries: number };
export type TrackingGroup = "assigned" | "picked-up" | "on-the-way" | "delivered" | "failed" | "closed";

/** A delivery assignment with its partner and order, for management tracking. */
export interface Assignment {
  _id: string;
  status: DeliveryStatus;
  active: boolean;
  assignedAt: string;
  assignedBy: string;
  completedAt: string | null;
  notes: string;
  failureReason: string;
  history: DeliveryHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  deliveryPartner: { _id: string; fullName: string; phone: string; email?: string; region?: string; transportType?: TransportType; vehicleType?: string } | null;
  order: {
    _id: string; number: string; customer: { name: string }; shippingAddress: OrderAddress; status: OrderStatus; total: number; isPaid: boolean; paymentMethod: "cash";
    items?: { name: string; unit: string; quantity: number; price: number }[]; createdAt?: string;
  } | null;
}

export const deliveryAdminApi = {
  applications: (query: { status?: ApplicationStatus | ""; q?: string; page?: number; limit?: number } = {}) =>
    apiRequest<{ applications: ApplicationRow[]; counts: Record<ApplicationStatus | "all", number>; pagination: Pagination }>(`/admin/delivery/applications${toQuery(query)}`),
  application: (id: string) => apiRequest<{ application: ApplicationDetail }>(`/admin/delivery/applications/${encodeURIComponent(id)}`),
  review: (id: string, status: ApplicationStatus, reason = "") =>
    apiRequest<{ application: ApplicationRow; openDeliveries: number; message: string }>(`/admin/delivery/applications/${encodeURIComponent(id)}/status`, json("PATCH", { status, reason })),
  // For an approved applicant who lost their reference code; the admin passes the new code on by phone.
  activationCode: (id: string) => apiRequest<{ reference: string; message: string }>(`/admin/delivery/applications/${encodeURIComponent(id)}/activation-code`, json("POST")),
  partners: (available = false) => apiRequest<{ partners: PartnerRow[] }>(`/admin/delivery/partners${available ? "?available=true" : ""}`),
  assignments: (query: { status?: TrackingGroup | ""; q?: string; page?: number; limit?: number } = {}) =>
    apiRequest<{ assignments: Assignment[]; counts: Record<TrackingGroup | "all", number>; pagination: Pagination }>(`/admin/delivery/assignments${toQuery(query)}`),
  assignment: (id: string) => apiRequest<{ assignment: Assignment; attempts: Assignment[] }>(`/admin/delivery/assignments/${encodeURIComponent(id)}`),
};
