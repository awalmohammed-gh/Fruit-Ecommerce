import { randomInt } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import Product from "../models/Product.js";
import Order, { OTP_VISIBLE_STATUSES, type OrderDocument, type OrderStatus } from "../models/Order.js";
import { orderTotals, roundMoney } from "../config/pricing.js";
import { HttpError } from "../middleware/errors.js";
import { orderLimits } from "../config/orderLimits.js";

export interface CartLine { productId: string; quantity: number }

/**
 * Prices a cart from the database. `problems` lists lines that can't be fulfilled
 * (removed product, not enough stock) instead of failing, so the storefront can explain them.
 */
export async function quoteCart(lines: CartLine[], session: ClientSession | null = null) {
  const products = await Product.find({ _id: { $in: lines.map((line) => line.productId) } }).session(session);
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const items = [];
  const problems: { productId: string; name?: string; reason: "unavailable" | "insufficient_stock"; available: number }[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) { problems.push({ productId: line.productId, reason: "unavailable", available: 0 }); continue; }
    if (product.stock < line.quantity) problems.push({ productId: line.productId, name: product.name, reason: "insufficient_stock", available: product.stock });
    items.push({ product: product._id, name: product.name, image: product.image, unit: product.unit, price: product.price, quantity: line.quantity,
      originalPrice: product.originalPrice ?? product.price, stock: product.stock });
  }
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { items, problems, ...orderTotals(subtotal) };
}

// Conditional decrement: two shoppers can't both buy the last unit.
export async function reserveStock(lines: CartLine[], session: ClientSession) {
  for (const line of lines) {
    const result = await Product.updateOne({ _id: line.productId, stock: { $gte: line.quantity } }, { $inc: { stock: -line.quantity } }, { session });
    if (!result.modifiedCount) {
      const product = await Product.findById(line.productId).session(session);
      throw new HttpError(409, product ? `Only ${product.stock} of ${product.name} left. Update your cart and try again.` : "A product in your cart is no longer available");
    }
  }
}

export async function restoreStock(order: OrderDocument, session: ClientSession) {
  const fresh = await Order.findById(order._id).select("+stockRestored").session(session);
  if (!fresh || fresh.stockRestored) return;
  for (const item of order.items) await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session });
  await Order.updateOne({ _id: order._id }, { stockRestored: true }, { session });
}

export const newDeliveryOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function setStatus(order: OrderDocument, status: OrderStatus, note: string) {
  order.status = status;
  order.statusHistory.push({ status, note, timestamp: new Date() });
  if (status === "Delivered" && order.paymentMethod === "cash" && !order.isPaid) {
    // Cash is collected at the door.
    order.isPaid = true;
    order.paidAt = new Date();
  }
}

/** Runs `work` in a transaction; the replica set required by connectDatabase makes this available everywhere. */
export const transaction = <T>(work: (session: ClientSession) => Promise<T>) => mongoose.connection.transaction(work);

const partnerFields = "fullName phone transportType";
export const withPartner = <Q extends { populate: (path: string, select: string) => Q }>(query: Q) => query.populate("deliveryPartner", partnerFields);

type Audience = "customer" | "admin" | "partner";
/** Shapes an order for who's asking. Only the customer ever receives the delivery code. */
// Accepts populated and unpopulated documents alike.
export function present(order: Pick<OrderDocument, "toObject" | "status" | "total">, audience: Audience) {
  const { deliveryOtp, stockRestored: _restored, __v: _version, ...fields } = order.toObject();
  const showOtp = audience === "customer" && OTP_VISIBLE_STATUSES.includes(order.status as OrderStatus);
  return { ...fields, ...(showOtp && deliveryOtp ? { deliveryOtp } : {}), total: roundMoney(order.total) };
}

/**
 * Cancels orders GreenFarm hasn't confirmed within orderLimits.confirmWithinHours and puts their stock back
 * on sale, so unconfirmed orders can't hold stock indefinitely. Returns how many were cancelled.
 */
export async function cancelUnconfirmedOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - orderLimits.confirmWithinHours * 3_600_000);
  const note = `Cancelled automatically: not confirmed within ${orderLimits.confirmWithinHours} hours`;
  let cancelled = 0;
  for (const { _id } of await Order.find({ status: "Order Placed", createdAt: { $lt: cutoff } }).select("_id").limit(200).lean()) {
    const done = await transaction(async (session) => {
      // Re-read inside the transaction: the admin may have confirmed it in the meantime.
      const order = await Order.findOne({ _id, status: "Order Placed" }).session(session);
      if (!order) return false;
      setStatus(order, "Cancelled", note);
      order.cancelReason = note;
      await order.save({ session });
      await restoreStock(order, session);
      return true;
    });
    if (done) cancelled += 1;
  }
  return cancelled;
}
