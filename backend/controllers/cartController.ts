import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import Cart, { type CartDocument } from '../models/Cart.js';
import Product from '../models/Product.js';
import { orderLimits } from '../config/orderLimits.js';
import { HttpError } from '../middleware/errors.js';
import { bodyObject, id } from '../middleware/validate.js';

async function snapshot(userId: mongoose.Types.ObjectId) {
  const cart = await Cart.findOne({ user: userId });
  const products = await Product.find({ _id: { $in: cart?.items.map((line) => line.product) ?? [] } });
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return {
    ownerId: String(userId),
    items: (cart?.items ?? []).flatMap((line) => {
      const product = byId.get(String(line.product));
      return product ? [{ product, quantity: line.quantity }] : [];
    }),
  };
}

// Optimistic concurrency prevents concurrent requests/tabs overwriting one another's changes.
async function mutate(userId: mongoose.Types.ObjectId, change: (cart: CartDocument) => void) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const cart = await Cart.findOne({ user: userId }) ?? new Cart({ user: userId });
    change(cart);
    try {
      await cart.save();
      return snapshot(userId);
    } catch (error) {
      const duplicateOwner = (error as { code?: number; keyPattern?: { user?: number } }).code === 11000
        && (error as { keyPattern?: { user?: number } }).keyPattern?.user;
      if (!(error instanceof mongoose.Error.VersionError) && !duplicateOwner) throw error;
    }
  }
  throw new HttpError(409, 'Your cart changed in another request. Please try again.');
}

function quantity(body: unknown) {
  bodyObject(body);
  const value = body.quantity;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > orderLimits.maxPerProduct)
    throw new HttpError(400, `Quantity must be a whole number from 1 to ${orderLimits.maxPerProduct}`);
  return value;
}

export const cartController = {
  list: async (req: Request, res: Response) => { res.json(await snapshot(req.user._id)); },
  add: async (req: Request, res: Response) => {
    const count = quantity(req.body);
    const productId = id(req.body.productId, 'productId').toLowerCase();
    const product = await Product.findById(productId);
    if (!product) throw new HttpError(404, 'Product not found');
    if (product.stock < 1) throw new HttpError(409, 'This product is out of stock');
    res.json(await mutate(req.user._id, (cart) => {
      const line = cart.items.find((entry) => String(entry.product) === productId);
      const limit = Math.min(product.stock, orderLimits.maxPerProduct);
      if (line) line.quantity = Math.min(line.quantity + count, limit);
      else {
        if (cart.items.length >= 50) throw new HttpError(400, 'A cart can contain at most 50 different products');
        cart.items.push({ product: product._id, quantity: Math.min(count, limit) });
      }
    }));
  },
  update: async (req: Request, res: Response) => {
    const count = quantity(req.body);
    const productId = id(req.params.productId, 'productId').toLowerCase();
    res.json(await mutate(req.user._id, (cart) => {
      const line = cart.items.find((entry) => String(entry.product) === productId);
      if (!line) throw new HttpError(404, 'Cart item not found');
      line.quantity = count;
    }));
  },
  remove: async (req: Request, res: Response) => {
    const productId = id(req.params.productId, 'productId').toLowerCase();
    res.json(await mutate(req.user._id, (cart) => {
      cart.items = cart.items.filter((line) => String(line.product) !== productId) as typeof cart.items;
    }));
  },
  clear: async (req: Request, res: Response) => {
    res.json(await mutate(req.user._id, (cart) => { cart.items.splice(0); }));
  },
};
