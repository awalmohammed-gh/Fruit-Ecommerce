import type { OrderStatus } from "../../../types";
import type { Granularity, OrderStage, RevenueBucketResponse } from "../../../frontApisRoute/orders";

export type { Granularity, OrderStage };
export const ORDER_STATUSES: OrderStatus[] = ["Order Placed", "Confirmed", "Packed", "Assigned", "Out for Delivery", "Delivered", "Cancelled"];
// Statuses management sets by hand. Assigned, Out for Delivery and Delivered follow the delivery partner.
export const MANAGEMENT_STATUSES: OrderStatus[] = ["Order Placed", "Confirmed", "Packed", "Cancelled"];
// Same rule as the API: a partner can be assigned once the order is confirmed.
export const READY_FOR_DELIVERY: OrderStatus[] = ["Confirmed", "Packed", "Assigned", "Out for Delivery"];
export const STAGE_LABEL: Record<OrderStage, string> = { pending: "Pending", processing: "Processing", completed: "Completed", cancelled: "Cancelled" };

// Same grouping the API uses for its stage filter and counts.
export function orderStage(status: string): OrderStage {
  if (status === "Delivered") return "completed";
  if (status === "Cancelled") return "cancelled";
  if (status === "Order Placed" || status === "Confirmed") return "pending";
  return "processing";
}

export interface RevenueBucket { label: string; detail: string; start: Date; end: Date; value: number }
const short = (value: Date, options: Intl.DateTimeFormatOptions) => value.toLocaleDateString("en-GB", { timeZone: "UTC", ...options });

/** Adds chart labels to the server's revenue buckets. Periods are calendar days/weeks/months in UTC (Ghana time). */
export function labelBuckets(buckets: RevenueBucketResponse[], granularity: Granularity): RevenueBucket[] {
  return buckets.map((bucket) => {
    const start = new Date(bucket.start);
    const label = granularity === "monthly" ? short(start, { month: "short" }) : short(start, { day: "numeric", month: "short" });
    const detail = granularity === "daily" ? short(start, { weekday: "long", day: "numeric", month: "long" })
      : granularity === "weekly" ? `Week of ${short(start, { day: "numeric", month: "long" })}`
      : short(start, { month: "long", year: "numeric" });
    return { label, detail, start, end: new Date(bucket.end), value: bucket.revenue };
  });
}
