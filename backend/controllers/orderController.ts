import type { Request, Response } from "express";
import type { Types } from "mongoose";
import Order, { type OrderStatus } from "../models/Order.js";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { pricing } from "../config/pricing.js";
import { orderLimits } from "../config/orderLimits.js";
import { notifyOrder } from "../services/notifications.js";
import { sharedCache } from "../middleware/cache.js";
import { newDeliveryOtp, present, quoteCart, reserveStock, restoreStock, setStatus, transaction, withPartner } from "../services/orders.js";

// Customers can cancel until someone has been sent to pack or deliver the order.
const CUSTOMER_CANCELLABLE: OrderStatus[] = ["Order Placed", "Confirmed"];

// The order an earlier send of the same checkout created, if there is one.
const placedWith = (userId: Types.ObjectId, checkoutKey: string | null) =>
  checkoutKey ? withPartner(Order.findOne({ user: userId, checkoutKey }).select("+deliveryOtp")) : null;

export const orderController = {
  pricing: async (_req: Request, res: Response) => {
    // Fixed in config/pricing.ts; it only changes with a deployment.
    sharedCache(res, 3600);
    res.json({ pricing, limits: { maxPerProduct: orderLimits.maxPerProduct } });
  },
  // Current prices and stock for a cart, before the customer commits.
  quote: async (req: Request, res: Response) => {
    res.json({ quote: await quoteCart(validate.cartItems(req.body)) });
  },
  create: async (req: Request, res: Response) => {
    const input = validate.newOrder(req.body);
    const checkoutKey = validate.checkoutKey(req.get("Idempotency-Key"));
    const user = req.user;
    // The same checkout sent again (a double click, a retry after a dropped connection) gets the first order back.
    const earlier = await placedWith(user._id, checkoutKey);
    if (earlier) return void res.json({ message: "Order placed", order: present(earlier, "customer") });
    const order = await transaction(async (session) => {
      const waiting = await Order.countDocuments({ user: user._id, status: "Order Placed" }).session(session);
      if (waiting >= orderLimits.maxAwaitingConfirmation)
        throw new HttpError(409, `You have ${waiting} orders waiting for GreenFarm to confirm. You can place another once one of them is confirmed.`);
      const address = await Address.findOne({ _id: input.addressId, user: user._id }).session(session);
      if (!address) throw new HttpError(404, "Choose one of your saved delivery addresses");
      const quote = await quoteCart(input.items, session);
      if (quote.problems.length) {
        const problem = quote.problems[0]!;
        throw new HttpError(409, problem.reason === "unavailable"
          ? "A product in your cart is no longer available. Remove it and try again."
          : `Only ${problem.available} of ${problem.name} left. Update your cart and try again.`);
      }
      await reserveStock(input.items, session);
      const { user: _owner, _id: _addressId, createdAt: _c, updatedAt: _u, __v: _v, ...shippingAddress } = address.toObject();
      const created = new Order({
        user: user._id,
        customer: { name: user.fullName, email: user.email, phone: user.phone },
        items: quote.items.map(({ product, name, image, unit, price, quantity }) => ({ product, name, image, unit, price, quantity })),
        shippingAddress,
        paymentMethod: input.paymentMethod,
        subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, tax: quote.tax, total: quote.total,
        deliveryOtp: newDeliveryOtp(),
        statusHistory: [{ status: "Order Placed", note: "Order placed", timestamp: new Date() }],
        ...(checkoutKey && { checkoutKey }),
      });
      await created.save({ session });
      // The purchased cart is cleared atomically with stock reservation and order creation.
      await Cart.updateOne({ user: user._id }, { $set: { items: [] }, $inc: { __v: 1 } }, { session });
      await notifyOrder(created, "Order Placed", session, true);
      return created;
    }).catch(async (error: unknown) => {
      // Both sends ran at once and the other one won: answer with its order.
      const duplicate = (error as { code?: number; keyPattern?: Record<string, unknown> }).code === 11000 && await placedWith(user._id, checkoutKey);
      if (duplicate) return duplicate;
      throw error;
    });
    res.status(201).json({ message: "Order placed", order: present(order, "customer") });
  },
  mine: async (req: Request, res: Response) => {
    const orders = await withPartner(Order.find({ user: req.user._id }).sort({ createdAt: -1 }).select("+deliveryOtp"));
    res.json({ orders: orders.map((order) => present(order, "customer")) });
  },
  get: async (req: Request, res: Response) => {
    const id = validate.id(req.params.id, "Order ID");
    const order = await withPartner(Order.findOne({ _id: id, user: req.user._id }).select("+deliveryOtp"));
    if (!order) throw new HttpError(404, "Order not found");
    res.json({ order: present(order, "customer") });
  },
  cancel: async (req: Request, res: Response) => {
    const id = validate.id(req.params.id, "Order ID");
    const order = await transaction(async (session) => {
      const found = await Order.findOne({ _id: id, user: req.user._id }).session(session);
      if (!found) throw new HttpError(404, "Order not found");
      if (!CUSTOMER_CANCELLABLE.includes(found.status as OrderStatus))
        throw new HttpError(409, "This order is already being prepared or delivered, so it can't be cancelled here");
      setStatus(found, "Cancelled", "Cancelled by customer");
      found.cancelReason = "Cancelled by customer";
      await found.save({ session });
      await restoreStock(found, session);
      await notifyOrder(found, "Cancelled", session, true);
      return found;
    });
    res.json({ message: "Order cancelled", order: present(order, "customer") });
  },
};
