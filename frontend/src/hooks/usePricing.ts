import { ordersApi } from "../frontApisRoute/orders";
import { useResource } from "./useResource";

let pending: ReturnType<typeof ordersApi.pricing> | null = null;
const loadPricing = () => {
  pending ??= ordersApi.pricing().catch((error) => { pending = null; throw error; });
  return pending;
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Delivery and tax rules from the server, for showing estimates before checkout.
 * The order itself is always priced by the server.
 */
export function usePricing() {
  const { data } = useResource("pricing", loadPricing);
  const pricing = data?.pricing ?? null;
  const estimate = (subtotal: number) => {
    if (!pricing) return null;
    const deliveryFee = subtotal > pricing.freeDeliveryOver ? 0 : pricing.deliveryFee;
    const tax = round(subtotal * pricing.taxRate);
    return { deliveryFee, tax, total: round(subtotal + deliveryFee + tax), toFreeDelivery: Math.max(0, round(pricing.freeDeliveryOver - subtotal)) };
  };
  return { pricing, estimate };
}
