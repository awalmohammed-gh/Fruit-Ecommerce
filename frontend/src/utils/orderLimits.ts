import type { Product } from "../types";

// Units of one product a single order may contain. Mirrors backend config/orderLimits.ts, which enforces it.
export const MAX_PER_PRODUCT = 20;

/** The most of `product` a shopper can put in one order: what's in stock, up to the per-order limit. */
export const maxQuantity = (product: Pick<Product, "stock">) => Math.max(0, Math.min(product.stock, MAX_PER_PRODUCT));

/** A random ID for one checkout attempt, so sending the same order twice still creates only one. */
export function newCheckoutKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
