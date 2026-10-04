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
  // Walks every page; used for exports where the whole catalogue is needed.
  all: async (query: ProductQuery = {}) => {
    const products: AdminProduct[] = [];
    for (let page = 1; ; page++) {
      const result = await productsApi.list({ ...query, page, limit: 48 });
      products.push(...result.products);
      if (page >= result.pagination.totalPages) return products;
    }
  },
};
