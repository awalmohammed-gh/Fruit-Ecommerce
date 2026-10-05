import type { Request, Response } from "express";
import type { PipelineStage } from "mongoose";
import Order, { FINAL_STATUSES, ORDER_STATUSES, type OrderDocument, type OrderStatus } from "../models/Order.js";
import DeliveryAssignment from "../models/DeliveryAssignment.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { roundMoney } from "../config/pricing.js";
import { present, restoreStock, setStatus, transaction, withPartner } from "../services/orders.js";
import { closeForCancelledOrder } from "../services/delivery.js";
import { notifyOrder } from "../services/notifications.js";

export const STAGES: Record<string, OrderStatus[]> = {
  pending: ["Order Placed", "Confirmed"],
  processing: ["Packed", "Assigned", "Out for Delivery"],
  completed: ["Delivered"],
  cancelled: ["Cancelled"],
};
const PAGE_SIZE = 15;
const counted = { status: { $ne: "Cancelled" as OrderStatus } }; // cancelled orders never count as revenue
// Assigned, Out for Delivery and Delivered come from the delivery partner's progress, never from a dropdown.
const MANAGEMENT_STATUSES: OrderStatus[] = ["Order Placed", "Confirmed", "Packed", "Cancelled"];

const param = (req: Request, key: string) => (typeof req.query[key] === "string" ? (req.query[key] as string).trim() : "");
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function pageNumber(req: Request, key: string, fallback: number, max = Infinity) {
  const value = Number(param(req, key) || fallback);
  if (!Number.isInteger(value) || value < 1) throw new HttpError(400, `${key} must be a whole number of 1 or more`);
  return Math.min(value, max);
}

// Calendar boundaries in UTC, which is Ghana's local time all year.
const DAY = 86_400_000;
const dayStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const weekStart = (date: Date) => new Date(dayStart(date).getTime() - ((date.getUTCDay() + 6) % 7) * DAY);
const monthStart = (date: Date, offset = 0) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));

async function findOrder(id: unknown) {
  const order = await Order.findById(validate.id(id, "Order ID"));
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}
/** The admin view of an order: current partner plus every delivery attempt, oldest first. */
export async function adminOrderView(order: OrderDocument) {
  await order.populate("deliveryPartner", "fullName phone transportType");
  const assignments = await DeliveryAssignment.find({ order: order._id }).sort({ assignedAt: 1 }).populate("deliveryPartner", "fullName phone").lean();
  return { ...present(order, "admin"), assignments: assignments.map(({ __v: _v, ...fields }) => fields) };
}
const respond = async (res: Response, order: OrderDocument, message: string) => {
  res.json({ message, order: await adminOrderView(order) });
};

export const adminOrderController = {
  list: async (req: Request, res: Response) => {
    const base: Record<string, unknown> = {};
    const search = param(req, "q").slice(0, 100);
    if (search) {
      const pattern = new RegExp(escapeRegex(search.replace(/^#/, "")), "i");
      base.$or = [{ number: pattern }, { "customer.name": pattern }, { "customer.email": pattern }];
    }
    const payment = param(req, "payment");
    if (payment === "paid" || payment === "unpaid") base.isPaid = payment === "paid";
    const stage = param(req, "stage");
    if (stage && !STAGES[stage]) throw new HttpError(400, "stage must be pending, processing, completed or cancelled");
    const filter = stage ? { ...base, status: { $in: STAGES[stage] } } : base;
    const page = pageNumber(req, "page", 1);
    const limit = pageNumber(req, "limit", PAGE_SIZE, 100);
    const [orders, total, statusCounts] = await Promise.all([
      withPartner(Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)),
      Order.countDocuments(filter),
      Order.aggregate<{ _id: OrderStatus; count: number }>([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    // Tab counts reflect the search and payment filter, but not the selected stage.
    const counts = Object.fromEntries(Object.entries(STAGES).map(([key, statuses]) => [key, statusCounts.filter((row) => statuses.includes(row._id)).reduce((sum, row) => sum + row.count, 0)]));
    res.json({
      orders: orders.map((order) => present(order, "admin")),
      counts: { all: statusCounts.reduce((sum, row) => sum + row.count, 0), ...counts },
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  },
  get: async (req: Request, res: Response) => {
    await respond(res, await findOrder(req.params.id), "Order");
  },
  updateStatus: async (req: Request, res: Response) => {
    validate.bodyObject(req.body);
    const status = req.body.status as OrderStatus;
    if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, "Choose a valid order status");
    if (!MANAGEMENT_STATUSES.includes(status)) throw new HttpError(400, `${status} is set by the delivery partner. Assign a partner to the order instead.`);
    const order = await transaction(async (session) => {
      const found = await Order.findById(validate.id(req.params.id, "Order ID")).session(session);
      if (!found) throw new HttpError(404, "Order not found");
      if (found.status === status) return found;
      if (FINAL_STATUSES.includes(found.status as OrderStatus)) throw new HttpError(409, `This order is already ${found.status.toLowerCase()} and can't change`);
      if (status !== "Cancelled" && (await DeliveryAssignment.exists({ order: found._id, active: true }).session(session)))
        throw new HttpError(409, "A delivery partner has this order. Reassign the delivery or cancel the order instead.");
      if (status === "Cancelled") await closeForCancelledOrder(found, session);
      setStatus(found, status, status === "Cancelled" ? "Cancelled by GreenFarm" : `Status updated to ${status}`);
      if (status === "Cancelled") found.cancelReason = "Cancelled by GreenFarm";
      await found.save({ session });
      if (status === "Cancelled") await restoreStock(found, session);
      await notifyOrder(found, status, session);
      return found;
    });
    await respond(res, order, `Order marked ${status}`);
  },
  // Headline figures: orders by status, all-time revenue and the current vs previous day, week and month.
  summary: async (_req: Request, res: Response) => {
    const now = new Date();
    const ranges = {
      today: [dayStart(now), new Date(dayStart(now).getTime() + DAY)],
      yesterday: [new Date(dayStart(now).getTime() - DAY), dayStart(now)],
      thisWeek: [weekStart(now), new Date(weekStart(now).getTime() + 7 * DAY)],
      lastWeek: [new Date(weekStart(now).getTime() - 7 * DAY), weekStart(now)],
      thisMonth: [monthStart(now), monthStart(now, 1)],
      lastMonth: [monthStart(now, -1), monthStart(now)],
    } as const;
    const facets: Record<string, PipelineStage.FacetPipelineStage[]> = {
      byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      revenue: [{ $match: counted }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }],
    };
    for (const [name, [start, end]] of Object.entries(ranges)) {
      facets[name] = [{ $match: { ...counted, createdAt: { $gte: start, $lt: end } } }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }];
    }
    const [result] = await Order.aggregate([{ $facet: facets }]);
    const figure = (rows: { revenue: number; orders: number }[]) => ({ revenue: roundMoney(rows[0]?.revenue ?? 0), orders: rows[0]?.orders ?? 0 });
    const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
    for (const row of result.byStatus as { _id: OrderStatus; count: number }[]) byStatus[row._id] = row.count;
    res.json({
      summary: {
        orders: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
        byStatus,
        stages: Object.fromEntries(Object.entries(STAGES).map(([stage, statuses]) => [stage, statuses.reduce((sum, status) => sum + byStatus[status], 0)])),
        allTime: figure(result.revenue),
        periods: Object.fromEntries(Object.keys(ranges).map((name) => [name, figure(result[name])])),
      },
    });
  },
  // Revenue per day (last 14), week (last 12) or month (last 12), oldest first.
  revenue: async (req: Request, res: Response) => {
    const granularity = param(req, "granularity") || "daily";
    const now = new Date();
    let starts: Date[];
    if (granularity === "daily") starts = Array.from({ length: 15 }, (_, index) => new Date(dayStart(now).getTime() + (index - 13) * DAY));
    else if (granularity === "weekly") starts = Array.from({ length: 13 }, (_, index) => new Date(weekStart(now).getTime() + (index - 11) * 7 * DAY));
    else if (granularity === "monthly") starts = Array.from({ length: 13 }, (_, index) => monthStart(now, index - 11));
    else throw new HttpError(400, "granularity must be daily, weekly or monthly");
    const orders = await Order.find({ ...counted, createdAt: { $gte: starts[0]!, $lt: starts[starts.length - 1]! } }).select("createdAt total").lean();
    const buckets = starts.slice(0, -1).map((start, index) => {
      const end = starts[index + 1]!;
      const inBucket = orders.filter((order) => order.createdAt >= start && order.createdAt < end);
      return { start, end, revenue: roundMoney(inBucket.reduce((sum, order) => sum + order.total, 0)), orders: inBucket.length };
    });
    res.json({ granularity, buckets });
  },
  // Units and revenue per product, with the product's live stock when it still exists.
  productRevenue: async (_req: Request, res: Response) => {
    const rows = await Order.aggregate([
      { $match: counted },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $last: "$items.name" }, image: { $last: "$items.image" }, unit: { $last: "$items.unit" },
        units: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "current", pipeline: [{ $project: { stock: 1 } }] } },
      { $project: { _id: 0, product: "$_id", name: 1, image: 1, unit: 1, units: 1, revenue: { $round: ["$revenue", 2] }, stock: { $ifNull: [{ $first: "$current.stock" }, null] } } },
      { $sort: { revenue: -1 } },
    ]);
    res.json({ products: rows });
  },
};
