export type StockState = "in" | "low" | "out";

export function stockState(stock: number, threshold: number): StockState {
  if (stock <= 0) return "out";
  return stock < threshold ? "low" : "in";
}

export const stockLabel: Record<StockState, string> = { in: "In stock", low: "Low stock", out: "Out of stock" };
