import mongoose from "mongoose";
import type { Request, Response } from "express";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";

const PAGE_SIZE = 10;

// The product's rating and reviewCount are always recalculated from the stored reviews.
async function refreshRating(productId: mongoose.Types.ObjectId) {
  const [stats] = await Review.aggregate<{ average: number; count: number }>([
    { $match: { product: productId } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: productId }, { rating: stats ? Math.round(stats.average * 10) / 10 : 0, reviewCount: stats?.count ?? 0 });
}

async function findProduct(req: Request) {
  const product = await Product.findById(validate.id(req.params.id, "Product ID")).select("_id name");
  if (!product) throw new HttpError(404, "Product not found");
  return product;
}

// Only customers who received the product can review it.
const hasReceived = (userId: mongoose.Types.ObjectId, productId: mongoose.Types.ObjectId) => Order.exists({ user: userId, status: "Delivered", "items.product": productId });

export const reviewController = {
  list: async (req: Request, res: Response) => {
    const product = await findProduct(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const [reviews, total, distribution] = await Promise.all([
      Review.find({ product: product._id }).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).select("-user -__v"),
      Review.countDocuments({ product: product._id }),
      Review.aggregate<{ _id: number; count: number }>([{ $match: { product: product._id } }, { $group: { _id: "$rating", count: { $sum: 1 } } }]),
    ]);
    const stars = Object.fromEntries([5, 4, 3, 2, 1].map((star) => [star, distribution.find((row) => row._id === star)?.count ?? 0]));
    const average = total ? distribution.reduce((sum, row) => sum + row._id * row.count, 0) / total : 0;
    res.json({ reviews, summary: { average: Math.round(average * 10) / 10, count: total, stars }, pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) } });
  },
  // Whether the signed-in customer may review, and their existing review if any.
  mine: async (req: Request, res: Response) => {
    const product = await findProduct(req);
    const [review, received] = await Promise.all([Review.findOne({ product: product._id, user: req.user._id }).select("-user -__v"), hasReceived(req.user._id, product._id)]);
    res.json({ canReview: !!received, review });
  },
  save: async (req: Request, res: Response) => {
    const product = await findProduct(req);
    const fields = validate.review(req.body);
    if (!(await hasReceived(req.user._id, product._id))) throw new HttpError(403, "You can review this product after it has been delivered to you");
    const review = await Review.findOneAndUpdate(
      { product: product._id, user: req.user._id },
      { ...fields, authorName: req.user.fullName },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    ).select("-user -__v");
    await refreshRating(product._id);
    res.json({ message: "Thanks for your review", review });
  },
};

// Used when a product is deleted so its reviews don't linger.
export const removeReviewsFor = (productId: mongoose.Types.ObjectId) => Review.deleteMany({ product: productId });
