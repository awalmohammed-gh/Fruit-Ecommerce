import mongoose from "mongoose";
import type { Request, Response } from "express";
import User, { safeUser } from "../models/User.js";
import Address, { safeAddress } from "../models/Address.js";
import { HttpError } from "../middleware/errors.js";
import { endAllSessions } from "../middleware/auth.js";
import Order from "../models/Order.js";
import { present } from "../services/orders.js";

// Order count and spend per customer; cancelled orders count as orders but not as spend.
async function orderStats(userIds: mongoose.Types.ObjectId[]) {
  const rows = await Order.aggregate<{ _id: mongoose.Types.ObjectId; orders: number; spent: number }>([
    { $match: { user: { $in: userIds } } },
    { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 0, "$total"] } } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), { orders: row.orders, totalSpent: Math.round(row.spent * 100) / 100 }]));
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function validId(req: Request) {
  if (!mongoose.isObjectIdOrHexString(req.params.id))
    throw new HttpError(400, "Invalid customer ID");
}

function param(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value.trim() : "";
}

function pageNumber(req: Request, key: string, fallback: number, max = Infinity) {
  const value = Number(param(req, key) || fallback);
  if (!Number.isInteger(value) || value < 1)
    throw new HttpError(400, `${key} must be a whole number of 1 or more`);
  return Math.min(value, max);
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const customerController = {
  list: async (req: Request, res: Response) => {
    const filter: Record<string, unknown> = {};
    const status = param(req, "status");
    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;
    const search = param(req, "q").slice(0, 100);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
    }
    const page = pageNumber(req, "page", 1);
    const limit = pageNumber(req, "limit", PAGE_SIZE, MAX_PAGE_SIZE);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    const stats = await orderStats(users.map((user) => user._id));
    res.json({
      customers: users.map((user) => ({ ...safeUser(user), ...(stats.get(String(user._id)) ?? { orders: 0, totalSpent: 0 }) })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  },
  stats: async (_req: Request, res: Response) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [total, active, joinedThisMonth] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: monthStart } }),
    ]);
    res.json({ stats: { total, active, inactive: total - active, joinedThisMonth } });
  },
  get: async (req: Request, res: Response) => {
    validId(req);
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, "Customer not found");
    const [addresses, orders, stats] = await Promise.all([
      Address.find({ user: user._id }).sort({ createdAt: 1, _id: 1 }),
      Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(20),
      orderStats([user._id]),
    ]);
    res.json({
      customer: { ...safeUser(user), ...(stats.get(String(user._id)) ?? { orders: 0, totalSpent: 0 }) },
      orders: orders.map((order) => present(order, "admin")),
      addresses: addresses.map((address) => safeAddress(address, user.defaultAddress)),
    });
  },
  // Deactivating also signs the customer out everywhere.
  setStatus: async (req: Request, res: Response) => {
    validId(req);
    if (typeof req.body?.isActive !== "boolean")
      throw new HttpError(400, "isActive must be true or false");
    const user = await User.findById(req.params.id).select("+tokenVersion");
    if (!user) throw new HttpError(404, "Customer not found");
    if (user.isActive !== req.body.isActive) {
      user.isActive = req.body.isActive;
      if (!user.isActive) user.tokenVersion += 1;
      await user.save();
      if (!user.isActive) await endAllSessions("customer", user._id);
    }
    res.json({
      message: user.isActive ? "Customer activated" : "Customer deactivated",
      customer: safeUser(user),
    });
  },
};
