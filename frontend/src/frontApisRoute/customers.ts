import { apiRequest } from "./client";
import type { AuthUser } from "./auth";
import type { SavedAddress } from "./addresses";
import { toQuery, type Pagination } from "./products";
import type { Order } from "../types";

// orders counts every order placed; totalSpent leaves out cancelled ones.
export type Customer = AuthUser & { orders: number; totalSpent: number };
export interface CustomerStats { total: number; active: number; inactive: number; joinedThisMonth: number }
export interface CustomerQuery { q?: string; status?: "active" | "inactive" | ""; page?: number; limit?: number }

export const customersApi = {
  list: (query: CustomerQuery = {}) =>
    apiRequest<{ customers: Customer[]; pagination: Pagination }>(`/admin/customers${toQuery(query)}`),
  stats: () => apiRequest<{ stats: CustomerStats }>("/admin/customers/stats"),
  get: (id: string) => apiRequest<{ customer: Customer; addresses: SavedAddress[]; orders: Order[] }>(`/admin/customers/${encodeURIComponent(id)}`),
  setStatus: (id: string, isActive: boolean) =>
    apiRequest<{ customer: Customer; message: string }>(`/admin/customers/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
  all: async (query: CustomerQuery = {}) => {
    const customers: Customer[] = [];
    for (let page = 1; ; page++) {
      const result = await customersApi.list({ ...query, page, limit: 50 });
      customers.push(...result.customers);
      if (page >= result.pagination.totalPages) return customers;
    }
  },
};

export const uploadsApi = {
  // "content" keeps hero and banner pictures apart from product photos.
  image: (file: File, folder: "products" | "content" = "products") => {
    const body = new FormData();
    body.append("image", file);
    return apiRequest<{ url: string }>(`/admin/uploads/image?folder=${folder}`, { method: "POST", body });
  },
};
