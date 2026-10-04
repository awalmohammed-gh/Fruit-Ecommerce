import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import type { ClientSession } from "mongoose";
import DeliveryPartner from "../models/DeliveryPartner.js";
import DeliveryAssignment, { DELIVERY_STATUSES, FAILURE_REASONS, type AssignmentDocument, type DeliveryStatus } from "../models/DeliveryAssignment.js";
import Order, { type OrderDocument } from "../models/Order.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { transaction } from "../services/orders.js";
import { NEXT_STEP, deliveryForPartner, ownApplication, record, syncOrder } from "../services/delivery.js";
import { endSession, partnerBlock, restorePartner, startSession } from "../middleware/auth.js";
import { failureLock, signInLock } from "../middleware/rateLimit.js";
import type { AppConfig } from "../types.js";

// Compared against when the email has no password set, so every failed sign-in takes as long as a wrong password.
const NO_ACCOUNT_HASH = bcrypt.hashSync("greenfarm-no-account", 12);
// Wrong delivery codes allowed per delivery every 15 minutes, however many devices try.
const CODE_ATTEMPTS = 5;

const ORDER_FIELDS = "number shippingAddress total paymentMethod isPaid items status";
const HISTORY_PAGE = 20;
const IN_PROGRESS: DeliveryStatus[] = ["Accepted", "Picked Up", "On The Way"];
const FINISHED: DeliveryStatus[] = DELIVERY_STATUSES.filter((status) => !["Assigned", ...IN_PROGRESS].includes(status));
const dayStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const param = (req: Request, key: string) => (typeof req.query[key] === "string" ? (req.query[key] as string).trim() : "");

// What goes on the customer's order timeline for each step.
const ORDER_NOTE: Partial<Record<DeliveryStatus, (name: string) => string>> = {
  Accepted: (name) => `${name} accepted the delivery`,
  "Picked Up": (name) => `Picked up by ${name}`,
  "On The Way": (name) => `${name} is on the way`,
};

// Another partner's delivery looks exactly like one that doesn't exist.
async function ownAssignment(req: Request, session: ClientSession | null = null) {
  const assignment = await DeliveryAssignment.findOne({ _id: validate.id(req.params.id, "Delivery ID"), deliveryPartner: req.deliveryPartner._id }).session(session);
  if (!assignment) throw new HttpError(404, "Delivery not found");
  return assignment;
}

/** Applies a partner's change to the assignment and its order in one transaction. `work` returns the order note. */
async function changeDelivery(req: Request, work: (assignment: AssignmentDocument, order: OrderDocument) => string) {
  const { assignment, order } = await transaction(async (session) => {
    const assignment = await ownAssignment(req, session);
    const order = await Order.findById(assignment.order).select("+deliveryOtp").session(session);
    if (!order) throw new HttpError(404, "Order not found");
    const note = work(assignment, order);
    syncOrder(order, assignment, note);
    await assignment.save({ session });
    await order.save({ session });
    return { assignment, order };
  });
  return deliveryForPartner(assignment, order);
}

function requireStatus(assignment: AssignmentDocument, allowed: DeliveryStatus[], message: string) {
  if (!allowed.includes(assignment.status as DeliveryStatus)) throw new HttpError(409, assignment.active ? message : "This delivery is closed and can't be updated");
}

/** A one-time reference like GF-7KQ2-M9XD, shown to the applicant once. Only its hash is stored. */
export function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `GF-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
export const hashReference = (reference: string) => createHash("sha256").update(reference.trim().toUpperCase()).digest("hex");

/** Finds an application by email and reference code. Wrong email and wrong code look the same. */
async function byReference(body: unknown) {
  validate.bodyObject(body);
  const email = validate.email(body);
  const reference = validate.text(body, "reference", { required: true, max: 20 });
  const partner = await DeliveryPartner.findOne({ email, replaced: false }).select("+referenceHash +tokenVersion");
  const expected = Buffer.from(partner?.referenceHash ?? "0".repeat(64), "hex");
  const matches = timingSafeEqual(Buffer.from(hashReference(reference), "hex"), expected);
  if (!partner || !matches) throw new HttpError(404, "We couldn't find an application with that email and reference code");
  return partner;
}

export function deliveryController(config: AppConfig) {
  // Failed sign-ins per partner account, and wrong delivery codes per delivery.
  const attempts = signInLock("sign-in", config.loginLockout);
  const wrongCodes = failureLock("delivery-code", CODE_ATTEMPTS, (minutes) => `Too many wrong codes for this delivery. Try again in ${minutes} minute${minutes === 1 ? "" : "s"} or contact GreenFarm.`);
  return {
    // ---------- Public: applying, checking status, activating ----------
    // No customer account is involved; the application is the partner's own record.
    apply: async (req: Request, res: Response) => {
      const fields = validate.deliveryApplication(req.body);
      const existing = await DeliveryPartner.findOne({ email: fields.email, replaced: false });
      if (existing && existing.applicationStatus !== "Rejected") {
        throw new HttpError(409, existing.applicationStatus === "Pending"
          ? "An application with this email is already under review. Use your reference code to check its status."
          : "This email already belongs to a GreenFarm delivery partner. Sign in to the delivery partner dashboard instead.");
      }
      const phoneTaken = await DeliveryPartner.exists({ phone: fields.phone, applicationStatus: { $ne: "Rejected" }, ...(existing ? { _id: { $ne: existing._id } } : {}) });
      if (phoneTaken) throw new HttpError(409, "This phone number is already used by another delivery partner application");

      const reference = newReference();
      const history = { status: "Pending" as const, by: "applicant", at: new Date() };
      // A rejected applicant may apply again. That is a new application: the rejected one stays exactly as it was
      // reviewed (marked replaced), so nobody who knows the email can rewrite someone else's application.
      const application = await transaction(async (session) => {
        if (existing) await DeliveryPartner.updateOne({ _id: existing._id, replaced: false }, { replaced: true }, { session });
        const [created] = await DeliveryPartner.create([{
          ...fields, referenceHash: hashReference(reference), previousApplication: existing?._id ?? null,
          statusHistory: [{ ...history, note: existing ? "Applied again after an earlier application was not approved" : "Application submitted" }],
        }], { session });
        return created!;
      });
      res.status(201).json({ message: "Application submitted", application: ownApplication(application), reference });
    },
    status: async (req: Request, res: Response) => {
      res.json({ application: ownApplication(await byReference(req.body)) });
    },
    // Approved applicants choose their password and are signed straight in.
    activate: async (req: Request, res: Response) => {
      const password = validate.password(req.body ?? {});
      const partner = await byReference(req.body);
      if (partner.applicationStatus !== "Approved") throw new HttpError(409, partnerBlock(partner) ?? "This application can't be activated");
      if (partner.accountActivated) throw new HttpError(409, "This account is already activated. Sign in with your email and password.");
      partner.password = password;
      partner.accountActivated = true;
      partner.isActive = true;
      partner.tokenVersion += 1;
      await partner.save();
      await startSession(res, config, "partner", partner._id, partner.tokenVersion);
      res.json({ message: "Account activated", partner: ownApplication(partner) });
    },
    login: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const email = validate.email(req.body);
      const password = validate.password(req.body, "password", false);
      const key = `partner:${email}`;
      await attempts.check(res, key);
      const partner = await DeliveryPartner.findOne({ email, replaced: false }).select("+password +tokenVersion");
      const matches = await bcrypt.compare(password, partner?.password || NO_ACCOUNT_HASH);
      // Same answer for an unknown email, a wrong password and an account that never set one.
      if (!partner?.password || !matches) {
        await attempts.fail(key);
        throw new HttpError(401, "Email or password is incorrect");
      }
      await attempts.clear(key);
      const blocked = partnerBlock(partner);
      if (blocked) throw new HttpError(403, blocked);
      await startSession(res, config, "partner", partner._id, partner.tokenVersion);
      res.json({ message: "Signed in", partner: ownApplication(partner) });
    },
    logout: async (req: Request, res: Response) => {
      await endSession(req, res, config, "partner");
      res.json({ message: "Signed out" });
    },
    // Restores the partner after a refresh; null when this browser has no delivery partner sign-in.
    me: async (req: Request, res: Response) => {
      const partner = await restorePartner(req, res, config);
      res.json({ partner: partner ? ownApplication(partner) : null });
    },

    // ---------- Approved partners ----------
    profile: async (req: Request, res: Response) => {
      res.json({ partner: ownApplication(req.deliveryPartner) });
    },
    updateProfile: async (req: Request, res: Response) => {
      Object.assign(req.deliveryPartner, validate.partnerProfile(req.body));
      await req.deliveryPartner.save();
      res.json({ message: "Profile updated", partner: ownApplication(req.deliveryPartner) });
    },
    summary: async (req: Request, res: Response) => {
      const mine = { deliveryPartner: req.deliveryPartner._id };
      const [assigned, inProgress, completed, today] = await Promise.all([
        DeliveryAssignment.countDocuments({ ...mine, status: "Assigned" }),
        DeliveryAssignment.countDocuments({ ...mine, status: { $in: IN_PROGRESS } }),
        DeliveryAssignment.countDocuments({ ...mine, status: "Delivered" }),
        DeliveryAssignment.countDocuments({ ...mine, assignedAt: { $gte: dayStart(new Date()) } }),
      ]);
      res.json({ summary: { assigned, inProgress, completed, today } });
    },
    // view=active: everything the partner currently holds. view=history: finished deliveries, filterable and paged.
    deliveries: async (req: Request, res: Response) => {
      const history = param(req, "view") === "history";
      const filter: Record<string, unknown> = { deliveryPartner: req.deliveryPartner._id };
      let page = 1;
      if (history) {
        const status = param(req, "status");
        if (status && !FINISHED.includes(status as DeliveryStatus)) throw new HttpError(400, "Choose a valid status");
        filter.status = status || { $in: FINISHED };
        const range: Record<string, Date> = {};
        for (const [key, operator] of [["from", "$gte"], ["to", "$lt"]] as const) {
          const value = param(req, key);
          if (!value) continue;
          const day = new Date(`${value}T00:00:00Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(day.getTime())) throw new HttpError(400, `${key} must be a date such as 2026-05-01`);
          // "to" includes the whole day.
          range[operator] = key === "to" ? new Date(day.getTime() + 86_400_000) : day;
        }
        if (Object.keys(range).length) filter.assignedAt = range;
        page = Math.max(1, Number.parseInt(param(req, "page"), 10) || 1);
      } else {
        filter.active = true;
      }
      const query = DeliveryAssignment.find(filter).sort({ assignedAt: history ? -1 : 1 });
      const [assignments, total] = await Promise.all([
        history ? query.skip((page - 1) * HISTORY_PAGE).limit(HISTORY_PAGE) : query.limit(100),
        DeliveryAssignment.countDocuments(filter),
      ]);
      const orders = await Order.find({ _id: { $in: assignments.map((assignment) => assignment.order) } }).select(ORDER_FIELDS);
      const byId = new Map(orders.map((order) => [String(order._id), order]));
      res.json({
        deliveries: assignments.map((assignment) => deliveryForPartner(assignment, byId.get(String(assignment.order)) ?? null)),
        pagination: { page, limit: history ? HISTORY_PAGE : 100, total, totalPages: Math.max(1, Math.ceil(total / (history ? HISTORY_PAGE : 100))) },
      });
    },
    // One of the partner's own deliveries, for the delivery details page.
    delivery: async (req: Request, res: Response) => {
      const assignment = await ownAssignment(req);
      const order = await Order.findById(assignment.order).select(ORDER_FIELDS);
      res.json({ delivery: deliveryForPartner(assignment, order) });
    },
    // Assigned → Accepted → Picked Up → On The Way, one step at a time.
    advance: async (req: Request, res: Response) => {
      const requested = req.body?.status;
      const delivery = await changeDelivery(req, (assignment) => {
        const next = NEXT_STEP[assignment.status as DeliveryStatus];
        if (!next || requested !== next) throw new HttpError(409, next ? `This delivery can only move to ${next} next` : "This delivery can't move forward from here");
        record(assignment, next, "partner");
        return ORDER_NOTE[next]!(req.deliveryPartner.fullName);
      });
      res.json({ message: `Delivery marked ${delivery.status}`, delivery });
    },
    // Turning down a new assignment hands it back to management.
    decline: async (req: Request, res: Response) => {
      const reason = validate.text(req.body ?? {}, "reason", { max: 300 });
      const delivery = await changeDelivery(req, (assignment) => {
        requireStatus(assignment, ["Assigned"], "Only a delivery you haven't accepted yet can be declined");
        assignment.failureReason = reason;
        record(assignment, "Declined", "partner", reason);
        return `${req.deliveryPartner.fullName} declined the delivery. Waiting for a new delivery partner.`;
      });
      res.json({ message: "Delivery declined", delivery });
    },
    fail: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const reason = req.body.reason as (typeof FAILURE_REASONS)[number];
      if (!FAILURE_REASONS.includes(reason)) throw new HttpError(400, "Choose what went wrong");
      const details = validate.text(req.body, "note", { required: reason === "Other", max: 300 });
      const summary = details ? `${reason}: ${details}` : reason;
      const delivery = await changeDelivery(req, (assignment) => {
        requireStatus(assignment, IN_PROGRESS, "Accept the delivery before reporting a problem");
        assignment.failureReason = summary;
        record(assignment, "Failed Delivery", "partner", summary);
        return `Delivery attempt failed (${summary}). GreenFarm will arrange another attempt.`;
      });
      res.json({ message: "Failed delivery reported", delivery });
    },
    // The customer reads the code from their order page; matching it confirms the hand-over.
    deliver: async (req: Request, res: Response) => {
      const otp = Buffer.from(typeof req.body?.otp === "string" ? req.body.otp.trim() : "");
      const key = String(req.params.id);
      await wrongCodes.check(res, key);
      const mismatch = new HttpError(400, "That code doesn't match. Ask the customer to check their order page.");
      const delivery = await changeDelivery(req, (assignment, order) => {
        requireStatus(assignment, ["On The Way"], "Start the delivery before marking it delivered");
        const expected = Buffer.from(order.deliveryOtp);
        if (otp.length !== expected.length || !timingSafeEqual(otp, expected)) throw mismatch;
        record(assignment, "Delivered", "partner");
        return `Delivered by ${req.deliveryPartner.fullName}`;
      }).catch(async (error: unknown) => {
        if (error === mismatch) await wrongCodes.fail(key);
        throw error;
      });
      await wrongCodes.clear(key);
      res.json({ message: "Delivery completed", delivery });
    },
    // Shown on the customer's tracking map while the partner carries the order.
    location: async (req: Request, res: Response) => {
      const { lat, lng } = validate.location(req.body);
      const assignment = await ownAssignment(req);
      requireStatus(assignment, ["Picked Up", "On The Way"], "Location is only shared once you have picked up the order");
      await Order.updateOne({ _id: assignment.order }, { liveLocation: { lat, lng, updatedAt: new Date() } });
      res.json({ message: "Location updated" });
    },
  };
}
