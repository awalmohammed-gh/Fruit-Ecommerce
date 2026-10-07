import mongoose from "mongoose";
import type { Request, Response } from "express";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { sharedCache } from "../middleware/cache.js";

function validId(req: Request) {
  if (!mongoose.isObjectIdOrHexString(req.params.id))
    throw new HttpError(400, "Invalid category ID");
}

// Product count per category, plus a cover picture from its newest product for categories without their own image.
async function productCounts() {
  const rows = await Product.aggregate<{ _id: string; count: number; cover: string }>([
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$category", count: { $sum: 1 }, cover: { $first: "$image" } } },
  ]);
  return new Map(rows.map((row) => [row._id, { count: row.count, cover: row.cover }]));
}

export const categoryController = {
  // Public results never include disabled categories or the management repair list.
  // Only what the navigation and category cards show; search-engine fields are read server-side (services/seo.ts).
  publicList: async (_req: Request, res: Response) => {
    const [categories, counts] = await Promise.all([
      Category.find({ isActive: { $ne: false } }).sort({ name: 1 }).select('name slug image description').lean(),
      productCounts(),
    ]);
    // The same for every visitor; after an admin change the storefront asks again with a fresh URL.
    sharedCache(res, 60);
    res.json({ categories: categories.map((category) => ({
      ...category, isActive: true, description: category.description ?? '',
      productCount: counts.get(category.slug)?.count ?? 0,
      cover: counts.get(category.slug)?.cover ?? '',
    })), unlisted: [] });
  },
  // Also reports slugs that products use but that have no category record yet,
  // so the admin can see and fix them instead of them silently disappearing.
  list: async (_req: Request, res: Response) => {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }).select("-__v").lean(),
      productCounts(),
    ]);
    const known = new Set(categories.map((category) => category.slug));
    res.json({
      categories: categories.map((category) => ({ ...category, isActive: category.isActive !== false, description: category.description ?? '', productCount: counts.get(category.slug)?.count ?? 0, cover: counts.get(category.slug)?.cover ?? "" })),
      unlisted: [...counts]
        .filter(([slug]) => !known.has(slug))
        .map(([slug, { count, cover }]) => ({ slug, productCount: count, cover }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    });
  },
  create: async (req: Request, res: Response) => {
    const fields = validate.category(req.body);
    if (await Category.exists({ slug: fields.slug! }))
      throw new HttpError(409, `A category with the slug "${fields.slug}" already exists`);
    const category = await Category.create(fields);
    res.status(201).json({
      message: "Category added",
      category: { ...category.toJSON(), productCount: await Product.countDocuments({ category: category.slug }) },
    });
  },
  update: async (req: Request, res: Response) => {
    validId(req);
    const { slug: _slug, ...fields } = validate.category(req.body, true);
    const category = await Category.findById(req.params.id);
    if (!category) throw new HttpError(404, "Category not found");
    Object.assign(category, fields);
    await category.save();
    res.json({
      message: "Category updated",
      category: { ...category.toJSON(), productCount: await Product.countDocuments({ category: category.slug }) },
    });
  },
  remove: async (req: Request, res: Response) => {
    validId(req);
    const category = await Category.findById(req.params.id);
    if (!category) throw new HttpError(404, "Category not found");
    const inUse = await Product.countDocuments({ category: category.slug });
    if (inUse)
      throw new HttpError(409, `Move or delete the ${inUse} product${inUse === 1 ? "" : "s"} in this category first`);
    await category.deleteOne();
    res.json({ message: "Category deleted", categoryId: category._id });
  },
};
