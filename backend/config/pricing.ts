// The only place order pricing is defined. The storefront reads these through GET /api/orders/pricing.
export const pricing = {
  currency: "GHS",
  freeDeliveryOver: 250,
  deliveryFee: 23,
  taxRate: 0.1,
} as const;

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function orderTotals(subtotal: number) {
  const deliveryFee = subtotal > pricing.freeDeliveryOver ? 0 : pricing.deliveryFee;
  const tax = roundMoney(subtotal * pricing.taxRate);
  return { subtotal: roundMoney(subtotal), deliveryFee, tax, total: roundMoney(subtotal + deliveryFee + tax) };
}
