import type { Request, Response } from "express";
import DeliveryPartner, { APPLICATION_STATUSES, type ApplicationStatus } from "../models/DeliveryPartner.js";
import DeliveryAssignment, { type DeliveryStatus } from "../models/DeliveryAssignment.js";
import Order from "../models/Order.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { transaction } from "../services/orders.js";
import { applicationRow, assignOrder, workloadFor } from "../services/delivery.js";
import { adminOrderView } from "./adminOrderController.js";
import { hashReference, newReference } from "./deliveryController.js";
import { endAllSessions } from "../middleware/auth.js";
import type { AppConfig } from "../types.js";

const PAGE_SIZE = 15;
const param = (req: Request, key: string) => (typeof req.query[key] === "string" ? (req.query[key] as string).trim() : "");
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageOf = (req: Request) => Math.max(1, Number.parseInt(param(req, "page"), 10) || 1);
const limitOf = (req: Request) => {
  const value = param(req, "limit");
  if (!value) return PAGE_SIZE;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, "limit must be between 1 and 100");
  return limit;
};
const pagination = (page: number, total: number, limit: number) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

// The only status changes management can make to an application.
const REVIEW_STEPS: Record<ApplicationStatus, ApplicationStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Suspended"],
  Suspended: ["Approved"],
  Rejected: [],
};
const REVIEW_MESSAGE: Record<ApplicationStatus, string> = {
  Approved: "approved", Rejected: "rejected", Suspended: "suspended", Pending: "moved back to pending",
};

// Tracking filters; each groups one or more delivery statuses.
export const TRACKING_GROUPS: Record<string, DeliveryStatus[]> = {
  assigned: ["Assigned", "Accepted"],
  "picked-up": ["Picked Up"],
  "on-the-way": ["On The Way"],
  delivered: ["Delivered"],
  failed: ["Failed Delivery", "Declined"],
  closed: ["Reassigned", "Cancelled"],
};

const PARTNER_FIELDS = "fullName phone email region transportType vehicleType";
const ORDER_FIELDS = "number customer.name shippingAddress status total isPaid paymentMethod";

// Management of delivery partner applications, partners and assignments.
export function deliveryAdminController(config: AppConfig) {
  const manager = () => config.admin?.email || "management";
  return {
    applications: async (req: Request, res: Response) => {
      const status = param(req, "status");
      if (status && !APPLICATION_STATUSES.includes(status as ApplicationStatus)) throw new HttpError(400, "status must be Pending, Approved, Rejected or Suspended");
      const base: Record<string, unknown> = {};
      const search = param(req, "q").slice(0, 100);
      if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        base.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
      }
      const filter = status ? { ...base, applicationStatus: status } : base;
      const page = pageOf(req);
      const limit = limitOf(req);
      const [rows, total, statusCounts] = await Promise.all([
        DeliveryPartner.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
        DeliveryPartner.countDocuments(filter),
        DeliveryPartner.aggregate<{ _id: ApplicationStatus; count: number }>([{ $match: base }, { $group: { _id: "$applicationStatus", count: { $sum: 1 } } }]),
      ]);
      const counts = Object.fromEntries(APPLICATION_STATUSES.map((name) => [name, statusCounts.find((row) => row._id === name)?.count ?? 0]));
      res.json({
        applications: rows.map(applicationRow),
        counts: { all: statusCounts.reduce((sum, row) => sum + row.count, 0), ...counts },
        pagination: pagination(page, total, limit),
      });
    },
    application: async (req: Request, res: Response) => {
      const partner = await DeliveryPartner.findById(validate.id(req.params.id, "Application ID"));
      if (!partner) throw new HttpError(404, "Application not found");
      const workload = (await workloadFor([partner._id])).get(String(partner._id)) ?? { activeDeliveries: 0, completedDeliveries: 0 };
      const { __v: _v, ...fields } = partner.toObject();
      res.json({ application: { ...fields, ...workload } });
    },
    review: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const status = req.body.status as ApplicationStatus;
      if (!APPLICATION_STATUSES.includes(status)) throw new HttpError(400, "Choose a valid application status");
      const reason = validate.text(req.body, "reason", { max: 300 });
      const partner = await DeliveryPartner.findById(validate.id(req.params.id, "Application ID")).select("+tokenVersion");
      if (!partner) throw new HttpError(404, "Application not found");
      const current = partner.applicationStatus as ApplicationStatus;
      if (!REVIEW_STEPS[current].includes(status)) {
        throw new HttpError(409, current === "Rejected" ? "This application was rejected. The applicant can submit a new one." : `A ${current.toLowerCase()} application can't be ${REVIEW_MESSAGE[status]}`);
      }
      partner.applicationStatus = status;
      if (status === "Approved") {
        partner.approvedAt ??= new Date();
        partner.approvedBy ||= manager();
        partner.suspensionReason = "";
        // First approval: they still have to activate. Reactivation restores an account that was already set up.
        partner.isActive = partner.accountActivated;
      }
      if (status === "Rejected") partner.rejectionReason = reason;
      if (status === "Suspended") {
        partner.suspensionReason = reason;
        partner.isActive = false;
        partner.tokenVersion += 1; // ends their dashboard sessions
      }
      const note = reason || (current === "Suspended" ? "Reactivated" : `Application ${REVIEW_MESSAGE[status]}`);
      partner.statusHistory.push({ status, note, by: manager(), at: new Date() });
      await partner.save();
      if (status === "Suspended") await endAllSessions("partner", partner._id);
      // Suspension blocks the partner at once; anything they still hold needs a new partner.
      const openDeliveries = status === "Suspended" ? await DeliveryAssignment.countDocuments({ deliveryPartner: partner._id, active: true }) : 0;
      const message = current === "Suspended" ? `${partner.fullName} reactivated` : `${partner.fullName} ${REVIEW_MESSAGE[status]}`;
      res.json({ message, application: applicationRow(partner), openDeliveries });
    },

    // For an approved applicant who lost their reference code: a new code to pass on by phone. The old one stops working.
    activationCode: async (req: Request, res: Response) => {
      const partner = await DeliveryPartner.findById(validate.id(req.params.id, "Application ID"));
      if (!partner) throw new HttpError(404, "Application not found");
      if (partner.applicationStatus !== "Approved" || partner.accountActivated) throw new HttpError(409, "Activation codes are only for approved partners who haven't activated yet");
      const reference = newReference();
      partner.referenceHash = hashReference(reference);
      partner.statusHistory.push({ status: "Approved", note: "New activation code issued", by: manager(), at: new Date() });
      await partner.save();
      res.json({ message: "New activation code issued", reference });
    },

    // Approved and suspended partners. available=true: only partners who can take a delivery now, least busy first.
    partners: async (req: Request, res: Response) => {
      const available = param(req, "available") === "true";
      // Only activated, active partners can sign in, so only they can take a delivery.
      const partners = await DeliveryPartner.find(available ? { applicationStatus: "Approved", accountActivated: true, isActive: true } : { applicationStatus: { $in: ["Approved", "Suspended"] } }).sort({ fullName: 1 });
      const workload = await workloadFor(partners.map((partner) => partner._id));
      const rows = partners.map((partner) => ({ ...applicationRow(partner), ...(workload.get(String(partner._id)) ?? { activeDeliveries: 0, completedDeliveries: 0 }) }));
      if (available) rows.sort((a, b) => a.activeDeliveries - b.activeDeliveries);
      res.json({ partners: rows });
    },

    assign: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const partnerId = validate.id(req.body.partnerId, "Delivery partner");
      const notes = validate.text(req.body, "notes", { max: 500 });
      const { order, partner } = await transaction((session) => assignOrder(validate.id(req.params.id, "Order ID"), partnerId, notes, manager(), session));
      res.json({ message: `Delivery assigned to ${partner.fullName}`, order: await adminOrderView(order) });
    },

    assignments: async (req: Request, res: Response) => {
      const group = param(req, "status");
      if (group && !TRACKING_GROUPS[group]) throw new HttpError(400, `status must be one of ${Object.keys(TRACKING_GROUPS).join(", ")}`);
      const base: Record<string, unknown> = {};
      const search = param(req, "q").replace(/^#/, "").slice(0, 100);
      if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        const [orders, partners] = await Promise.all([
          Order.find({ $or: [{ number: pattern }, { "customer.name": pattern }] }).select("_id").limit(200),
          DeliveryPartner.find({ fullName: pattern }).select("_id").limit(200),
        ]);
        base.$or = [{ order: { $in: orders.map((order) => order._id) } }, { deliveryPartner: { $in: partners.map((partner) => partner._id) } }];
      }
      const filter = group ? { ...base, status: { $in: TRACKING_GROUPS[group] } } : base;
      const page = pageOf(req);
      const limit = limitOf(req);
      const [rows, total, statusCounts] = await Promise.all([
        DeliveryAssignment.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
          .populate("deliveryPartner", PARTNER_FIELDS).populate("order", ORDER_FIELDS),
        DeliveryAssignment.countDocuments(filter),
        DeliveryAssignment.aggregate<{ _id: DeliveryStatus; count: number }>([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      ]);
      const counts = Object.fromEntries(Object.entries(TRACKING_GROUPS).map(([key, statuses]) => [key, statusCounts.filter((row) => statuses.includes(row._id)).reduce((sum, row) => sum + row.count, 0)]));
      res.json({
        assignments: rows.map((row) => { const { __v: _v, ...fields } = row.toObject(); return fields; }),
        counts: { all: statusCounts.reduce((sum, row) => sum + row.count, 0), ...counts },
        pagination: pagination(page, total, limit),
      });
    },
    // One delivery with its timeline, plus every earlier attempt on the same order.
    assignment: async (req: Request, res: Response) => {
      const assignment = await DeliveryAssignment.findById(validate.id(req.params.id, "Delivery ID"))
        .populate("deliveryPartner", PARTNER_FIELDS).populate("order", `${ORDER_FIELDS} items subtotal deliveryFee tax createdAt`);
      if (!assignment) throw new HttpError(404, "Delivery not found");
      const attempts = await DeliveryAssignment.find({ order: assignment.order._id }).sort({ assignedAt: 1 }).populate("deliveryPartner", "fullName phone");
      const plain = <T extends { toObject: () => Record<string, unknown> }>(doc: T) => { const { __v: _v, ...fields } = doc.toObject(); return fields; };
      res.json({ assignment: plain(assignment), attempts: attempts.map(plain) });
    },
  };
}
