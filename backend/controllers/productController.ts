import mongoose, { type QueryFilter, type SortOrder } from "mongoose";
import type { Request, Response } from "express";
import Product, { type ProductDocument } from "../models/Product.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { removeReviewsFor } from "./reviewController.js";

const PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;

// Keys match the `sort` values the storefront already puts in the URL.
const sorts: Record<string, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  rating: { rating: -1, reviewCount: -1, _id: 1 },
  name: { name: 1, _id: 1 },
  updated: { updatedAt: -1, _id: -1 },
  stock_asc: { stock: 1, _id: 1 },
  discount: { discount: -1, _id: 1 },
};

const DEFAULT_LOW_STOCK = 10;

function validId(req: Request) {
  if (!mongoose.isObjectIdOrHexString(req.params.id))
    throw new HttpError(400, "Invalid product ID");
}

function param(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(req: Request, key: string) {
  const raw = param(req, key);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0)
    throw new HttpError(400, `${key} must be a number of zero or more`);
  return value;
}

function pageNumber(req: Request, key: string, fallback: number, max = Infinity) {
  const value = Number(param(req, key) || fallback);
  if (!Number.isInteger(value) || value < 1)
    throw new HttpError(400, `${key} must be a whole number of 1 or more`);
  return Math.min(value, max);
}

function lowStockThreshold(req: Request) {
  const value = pageNumber(req, "lowStockBelow", DEFAULT_LOW_STOCK);
  return Math.min(value, 100000);
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function catalogueFilter(req: Request) {
  const filter: QueryFilter<ProductDocument> = {};
  const category = param(req, "category").toLowerCase();
  if (category) filter.category = category;
  const organic = param(req, "organic");
  if (organic === "true" || organic === "false") filter.isOrganic = organic === "true";
  if (param(req, "onSale") === "true") filter.discount = { $gt: 0 };
  if (param(req, "inStock") === "true") filter.stock = { $gt: 0 };

  // stock=in|low|out|restock; "low" and "restock" use the admin's low-stock threshold.
  const threshold = lowStockThreshold(req);
  const stockFilters: Record<string, QueryFilter<ProductDocument>["stock"]> = {
    in: { $gt: 0 },
    low: { $gt: 0, $lt: threshold },
    out: { $lte: 0 },
    restock: { $lt: threshold },
  };
  const stock = param(req, "stock");
  if (stock) {
    if (!stockFilters[stock]) throw new HttpError(400, "stock must be in, low, out or restock");
    filter.stock = stockFilters[stock];
  }

  const min = positiveNumber(req, "minPrice");
  const max = positiveNumber(req, "maxPrice");
  if (min !== undefined && max !== undefined && min > max)
    throw new HttpError(400, "minPrice cannot be greater than maxPrice");
  if (min !== undefined || max !== undefined)
    filter.price = { ...(min !== undefined && { $gte: min }), ...(max !== undefined && { $lte: max }) };

  const search = param(req, "q").slice(0, 100);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { description: pattern }];
  }
  return filter;
}

// Resolves the "was" price that goes with a new selling price.
// Leaving originalPrice out of an update keeps a running sale; a product
// that wasn't on sale stays that way when it's repriced.
function originalPriceFor(
  price: number,
  requested: number | null | undefined,
  current?: { price: number; originalPrice?: number | null },
) {
  let originalPrice = requested ?? price;
  if (requested === undefined && current && (current.originalPrice ?? 0) > current.price)
    originalPrice = current.originalPrice!;
  if (originalPrice < price)
    throw new HttpError(400, "originalPrice cannot be lower than price");
  return originalPrice;
}

export const productController = {
  list: async (req: Request, res: Response) => {
    const filter = catalogueFilter(req);
    const sort = sorts[param(req, "sort")] ?? sorts.newest!;
    const page = pageNumber(req, "page", 1);
    const limit = pageNumber(req, "limit", PAGE_SIZE, MAX_PAGE_SIZE);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-__v")
        .lean(),
      Product.countDocuments(filter),
    ]);
    res.json({
      products,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  },
  stats: async (req: Request, res: Response) => {
    const threshold = lowStockThreshold(req);
    const [totals] = await Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          inStock: { $sum: { $cond: [{ $gt: ["$stock", 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lt: ["$stock", threshold] }] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
          onSale: { $sum: { $cond: [{ $gt: ["$discount", 0] }, 1, 0] } },
          organic: { $sum: { $cond: ["$isOrganic", 1, 0] } },
          stockUnits: { $sum: "$stock" },
          inventoryValue: { $sum: { $multiply: ["$price", "$stock"] } },
          averageDiscount: { $avg: { $cond: [{ $gt: ["$discount", 0] }, "$discount", null] } },
          biggestDiscount: { $max: "$discount" },
        },
      },
      { $project: { _id: 0 } },
    ]);
    const empty = { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, onSale: 0, organic: 0, stockUnits: 0, inventoryValue: 0, averageDiscount: null, biggestDiscount: 0 };
    res.json({ stats: { ...empty, ...totals, inventoryValue: Math.round((totals?.inventoryValue ?? 0) * 100) / 100, lowStockBelow: threshold } });
  },
  // Accepts the database ID (older links) or the readable slug (/products/cheese-200g).
  get: async (req: Request, res: Response) => {
    const key = String(req.params.id);
    const product = mongoose.isObjectIdOrHexString(key) ? await Product.findById(key) : await Product.findOne({ slug: key.toLowerCase() });
    if (!product) throw new HttpError(404, "Product not found");
    res.json({ product });
  },
  create: async (req: Request, res: Response) => {
    const { originalPrice, ...fields } = validate.product(req.body);
    const product = await Product.create({
      ...fields,
      originalPrice: originalPriceFor(fields.price!, originalPrice),
    });
    res.status(201).json({ message: "Product added", product });
  },
  update: async (req: Request, res: Response) => {
    validId(req);
    const { originalPrice, ...fields } = validate.product(req.body, true);
    const product = await Product.findById(req.params.id);
    if (!product) throw new HttpError(404, "Product not found");
    const price = fields.price ?? product.price;
    Object.assign(product, fields, { originalPrice: originalPriceFor(price, originalPrice, product) });
    await product.save();
    res.json({ message: "Product updated", product });
  },
  // Products are only removed on purpose; running out of stock just leaves stock at 0.
  remove: async (req: Request, res: Response) => {
    validId(req);
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new HttpError(404, "Product not found");
    await removeReviewsFor(product._id);
    res.json({ message: "Product deleted", productId: product._id });
  },
};
