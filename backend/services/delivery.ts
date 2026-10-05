import type { ClientSession } from "mongoose";
import DeliveryAssignment, { OPEN_DELIVERY_STATUSES, type AssignmentDocument, type DeliveryStatus } from "../models/DeliveryAssignment.js";
import DeliveryPartner, { type DeliveryPartnerDocument } from "../models/DeliveryPartner.js";
import Order, { FINAL_STATUSES, READY_FOR_DELIVERY, type OrderDocument, type OrderStatus } from "../models/Order.js";
import { HttpError } from "../middleware/errors.js";
import { setStatus } from "./orders.js";
import { createNotification, notifyOrder } from "./notifications.js";

type Actor = "management" | "partner";

// What the customer sees on their order while a partner works through the delivery.
const ORDER_STATUS_FOR: Partial<Record<DeliveryStatus, OrderStatus>> = {
  Assigned: "Assigned", Accepted: "Assigned", "Picked Up": "Out for Delivery", "On The Way": "Out for Delivery", Delivered: "Delivered",
};
// A partner moves a delivery forward one step at a time.
export const NEXT_STEP: Partial<Record<DeliveryStatus, DeliveryStatus>> = { Assigned: "Accepted", Accepted: "Picked Up", "Picked Up": "On The Way" };

export function record(assignment: AssignmentDocument, status: DeliveryStatus, by: Actor, note = "") {
  assignment.status = status;
  assignment.history.push({ status, by, note, at: new Date() });
  if (!OPEN_DELIVERY_STATUSES.includes(status)) {
    assignment.active = false;
    assignment.completedAt = new Date();
  }
}

/** Brings the order in line with its assignment after the partner (or management) changes it. */
export function syncOrder(order: OrderDocument, assignment: AssignmentDocument, note: string) {
  const status = assignment.status as DeliveryStatus;
  order.deliveryStatus = status;
  const target = ORDER_STATUS_FOR[status];
  if (target && order.status !== target) setStatus(order, target, note);
  if (status === "Failed Delivery" || status === "Declined") {
    // Back with management, ready for another partner. deliveryStatus keeps the flag until then.
    order.deliveryPartner = null;
    order.assignment = null;
    setStatus(order, "Packed", note);
  }
}

/** Assigns or reassigns an order. Runs inside the caller's transaction. */
export async function assignOrder(orderId: string, partnerId: string, notes: string, assignedBy: string, session: ClientSession) {
  const partner = await DeliveryPartner.findOne({ _id: partnerId, applicationStatus: "Approved", accountActivated: true, isActive: true }).session(session);
  if (!partner) throw new HttpError(400, "Choose an approved partner who has activated their account");
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new HttpError(404, "Order not found");
  if (FINAL_STATUSES.includes(order.status as OrderStatus)) throw new HttpError(409, `This order is already ${order.status.toLowerCase()}`);
  if (!READY_FOR_DELIVERY.includes(order.status as OrderStatus)) throw new HttpError(409, "Confirm the order before assigning a delivery partner");

  const current = await DeliveryAssignment.findOne({ order: order._id, active: true }).session(session);
  if (current && String(current.deliveryPartner) === String(partner._id)) throw new HttpError(409, `This delivery is already assigned to ${partner.fullName}`);
  if (current) {
    record(current, "Reassigned", "management", `Reassigned to ${partner.fullName}`);
    await current.save({ session });
  }
  const [assignment] = await DeliveryAssignment.create([{
    order: order._id, deliveryPartner: partner._id, assignedBy, notes,
    history: [{ status: "Assigned", by: "management", note: notes || (current ? "Reassigned by management" : "Assigned by management"), at: new Date() }],
  }], { session });

  order.deliveryPartner = partner._id;
  order.assignment = assignment!._id;
  order.deliveryStatus = "Assigned";
  const note = `${current ? "Reassigned" : "Assigned"} to ${partner.fullName}`;
  if (order.status === "Assigned") order.statusHistory.push({ status: "Assigned", note, timestamp: new Date() });
  else setStatus(order, "Assigned", note);
  await order.save({ session });
  await notifyOrder(order, "Assigned", session);
  await createNotification({
    audience: "individual", recipient: String(partner._id), recipientAccount: "partner", type: "order",
    title: "Delivery assigned", message: `You have been assigned order #${order.number}.`,
    link: `/delivery-partner/deliveries/${assignment!._id}`,
  }, session);
  if (current) await createNotification({
    audience: "individual", recipient: String(current.deliveryPartner), recipientAccount: "partner", type: "order",
    title: "Delivery reassigned", message: `Order #${order.number} has been reassigned to another delivery partner.`,
    link: "/delivery-partner/history",
  }, session);
  return { order, assignment: assignment!, partner };
}

/** Closes the open assignment when management cancels the order. */
export async function closeForCancelledOrder(order: OrderDocument, session: ClientSession) {
  const current = await DeliveryAssignment.findOne({ order: order._id, active: true }).session(session);
  if (!current) return;
  record(current, "Cancelled", "management", "Order cancelled by management");
  await current.save({ session });
  order.deliveryStatus = "Cancelled";
  await createNotification({
    audience: "individual", recipient: String(current.deliveryPartner), recipientAccount: "partner", type: "order",
    title: "Delivery cancelled", message: `Order #${order.number} has been cancelled.`,
    link: "/delivery-partner/history",
  }, session);
}

// ---------- Shapes ----------

/** The application as its owner sees it: no reviewer details, and never the password or reference hashes. */
export function ownApplication(partner: DeliveryPartnerDocument) {
  const { approvedBy: _by, statusHistory: _history, password: _password, referenceHash: _reference, tokenVersion: _token, __v: _v, ...fields } = partner.toObject();
  return fields;
}

/** Summary row for management lists. */
export function applicationRow(partner: DeliveryPartnerDocument) {
  return {
    _id: partner._id, fullName: partner.fullName, email: partner.email, phone: partner.phone, region: partner.region, city: partner.city,
    transportType: partner.transportType, vehicleType: partner.vehicleType, applicationStatus: partner.applicationStatus,
    accountActivated: partner.accountActivated, isActive: partner.isActive, createdAt: partner.createdAt, approvedAt: partner.approvedAt,
  };
}

type OrderForPartner = Pick<OrderDocument, "_id" | "number" | "shippingAddress" | "total" | "paymentMethod" | "isPaid" | "items" | "status">;
/** Only what the partner needs to complete the delivery: no email, account or pricing breakdown. */
export function deliveryForPartner(assignment: AssignmentDocument, order: OrderForPartner | null) {
  const address = order?.shippingAddress;
  return {
    _id: assignment._id, status: assignment.status, assignedAt: assignment.assignedAt, completedAt: assignment.completedAt,
    notes: assignment.notes, failureReason: assignment.failureReason, history: assignment.history, updatedAt: assignment.updatedAt,
    order: order && address ? {
      _id: order._id, number: order.number, total: order.total, paymentMethod: order.paymentMethod, isPaid: order.isPaid,
      items: order.items.map((item) => ({ name: item.name, unit: item.unit, quantity: item.quantity })),
      recipient: { name: address.fullName ?? "", phone: address.phone ?? "" },
      address: {
        line1: address.addressLine1 ?? "", line2: address.addressLine2 ?? "", city: address.city ?? "", region: address.region ?? "",
        digitalAddress: address.digitalAddress ?? "", landmark: address.landmark ?? "",
      },
    } : null,
  };
}

/** Active and completed delivery counts per partner, keyed by partner ID. */
export async function workloadFor(partnerIds: unknown[]) {
  const rows = await DeliveryAssignment.aggregate<{ _id: unknown; active: number; completed: number }>([
    { $match: { deliveryPartner: { $in: partnerIds } } },
    { $group: { _id: "$deliveryPartner", active: { $sum: { $cond: ["$active", 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0] } } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), { activeDeliveries: row.active, completedDeliveries: row.completed }]));
}
