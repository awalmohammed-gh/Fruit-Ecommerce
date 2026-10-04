import { apiRequest } from "./client";
import { toQuery, type Pagination } from "./products";
import type { Order, OrderStatus } from "../types";

export interface PricingConfig { currency: string; freeDeliveryOver: number; deliveryFee: number; taxRate: number }
export interface CartLine { productId: string; quantity: number }
export interface QuoteItem { product: string; name: string; image: string; unit: string; price: number; originalPrice: number; quantity: number; stock: number }
export interface QuoteProblem { productId: string; name?: string; reason: "unavailable" | "insufficient_stock"; available: number }
export interface Quote { items: QuoteItem[]; problems: QuoteProblem[]; subtotal: number; deliveryFee: number; tax: number; total: number }

// Customer orders.
export const ordersApi = {
  pricing: () => apiRequest<{ pricing: PricingConfig }>("/orders/pricing"),
  quote: (items: CartLine[]) => apiRequest<{ quote: Quote }>("/orders/quote", { method: "POST", body: JSON.stringify({ items }) }),
  // checkoutKey identifies this checkout attempt: sending it again (double click, retry) returns the same order.
  create: (input: { addressId: string; paymentMethod: "cash"; items: CartLine[] }, checkoutKey: string) =>
    apiRequest<{ order: Order; message: string }>("/orders", { method: "POST", body: JSON.stringify(input), headers: { "Idempotency-Key": checkoutKey } }),
  mine: () => apiRequest<{ orders: Order[] }>("/orders"),
  get: (id: string) => apiRequest<{ order: Order }>(`/orders/${encodeURIComponent(id)}`),
  cancel: (id: string) => apiRequest<{ order: Order; message: string }>(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
};

export type OrderStage = "pending" | "processing" | "completed" | "cancelled";
export interface AdminOrderQuery { stage?: OrderStage | ""; q?: string; payment?: "paid" | "unpaid" | ""; page?: number; limit?: number }
export interface PeriodFigure { revenue: number; orders: number }
export interface OrderSummary {
  orders: number;
  byStatus: Record<OrderStatus, number>;
  stages: Record<OrderStage, number>;
  allTime: PeriodFigure;
  periods: Record<"today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth", PeriodFigure>;
}
export type Granularity = "daily" | "weekly" | "monthly";
export interface RevenueBucketResponse { start: string; end: string; revenue: number; orders: number }
export interface ProductRevenue { product: string; name: string; image: string; unit: string; units: number; revenue: number; stock: number | null }

// Admin order management and reporting.
export const adminOrdersApi = {
  list: (query: AdminOrderQuery = {}) =>
    apiRequest<{ orders: Order[]; counts: Record<OrderStage | "all", number>; pagination: Pagination }>(`/admin/orders${toQuery(query)}`),
  get: (id: string) => apiRequest<{ order: Order }>(`/admin/orders/${encodeURIComponent(id)}`),
  setStatus: (id: string, status: OrderStatus) =>
    apiRequest<{ order: Order; message: string }>(`/admin/orders/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  // Assigns or reassigns the delivery; earlier attempts are kept on the order.
  assign: (id: string, partnerId: string, notes = "") =>
    apiRequest<{ order: Order; message: string }>(`/admin/orders/${encodeURIComponent(id)}/partner`, { method: "PATCH", body: JSON.stringify({ partnerId, notes }) }),
  summary: () => apiRequest<{ summary: OrderSummary }>("/admin/orders/summary"),
  revenue: (granularity: Granularity) => apiRequest<{ buckets: RevenueBucketResponse[] }>(`/admin/orders/revenue${toQuery({ granularity })}`),
  productRevenue: () => apiRequest<{ products: ProductRevenue[] }>("/admin/orders/products"),
  all: async (query: Omit<AdminOrderQuery, "page" | "limit"> = {}) => {
    const orders: Order[] = [];
    for (let page = 1; ; page++) {
      const result = await adminOrdersApi.list({ ...query, page, limit: 50 });
      orders.push(...result.orders);
      if (page >= result.pagination.totalPages) return orders;
    }
  },
};
