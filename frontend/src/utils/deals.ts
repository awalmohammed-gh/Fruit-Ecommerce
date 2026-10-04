import type { Product } from "../types";

// Discounts come from the server; this only narrows and orders the list on the Deals page.
export function filterDeals(deals: Product[], category: string, sort: string) {
  const result = deals.filter((product) => !category || product.category === category);
  if (sort === "saving") result.sort((a, b) => (b.originalPrice - b.price) - (a.originalPrice - a.price));
  else if (sort === "price") result.sort((a, b) => a.price - b.price);
  else result.sort((a, b) => b.discount - a.discount);
  return result;
}
