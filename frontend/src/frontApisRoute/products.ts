import { apiRequest } from "./client";
import type { Product } from "../types";

export type AdminProduct = Product & { updatedAt: string };
export type StockFilter = "in" | "low" | "out" | "restock";
export interface ProductInput {
  name: string; description: string; category: string; unit: string; image: string;
  price: number; originalPrice: number | null; stock: number; isOrganic: boolean;
  seoTitle: string; seoDescription: string;
}
export interface ProductQuery {
  q?: string; category?: string; stock?: StockFilter | ""; organic?: "true" | "false" | ""; minPrice?: string | number; maxPrice?: string | number;
  onSale?: boolean; sort?: string; page?: number; limit?: number; lowStockBelow?: number;
  /** "card": only the fields a product card shows, for storefront lists. */
  view?: "card";
}
export interface Pagination { page: number; limit: number; total: number; totalPages: number }
export interface ProductStats {
  total: number; inStock: number; lowStock: number; outOfStock: number; onSale: number; organic: number;
  stockUnits: number; inventoryValue: number; averageDiscount: number | null; biggestDiscount: number; lowStockBelow: number;
}
type ProductResponse = { product: AdminProduct; message?: string };

export function toQuery(params: object) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const productsApi = {
  list: (query: ProductQuery = {}) =>
    apiRequest<{ products: AdminProduct[]; pagination: Pagination }>(`/products${toQuery(query)}`),
  get: (id: string) => apiRequest<ProductResponse>(`/products/${encodeURIComponent(id)}`),
  stats: (lowStockBelow: number) => apiRequest<{ stats: ProductStats }>(`/products/stats${toQuery({ lowStockBelow })}`),
  create: (input: ProductInput) => apiRequest<ProductResponse>("/products", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Partial<ProductInput>) =>
    apiRequest<ProductResponse>(`/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => apiRequest<{ message: string }>(`/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
  // Every page; used for exports where the whole catalogue is needed. The first page says how many there are,
  // then the rest load side by side rather than one after another.
  all: async (query: ProductQuery = {}) => {
    const first = await productsApi.list({ ...query, page: 1, limit: 48 });
    const rest = await Promise.all(Array.from({ length: first.pagination.totalPages - 1 }, (_, index) => productsApi.list({ ...query, page: index + 2, limit: 48 })));
    return [first, ...rest].flatMap((result) => result.products);
  },
};
