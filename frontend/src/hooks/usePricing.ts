import { useState } from "react";
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
 * `needed` false: nothing is fetched yet (the cart drawer is mounted on every page but rarely open).
 * Once fetched, the rules are shared for the rest of the visit.
 */
export function usePricing(needed = true) {
  const [wanted, setWanted] = useState(needed);
  if (needed && !wanted) setWanted(true);
  const { data } = useResource(wanted ? "pricing" : "pricing:later", () => (wanted ? loadPricing() : Promise.resolve(null)));
  const pricing = data?.pricing ?? null;
  const estimate = (subtotal: number) => {
    if (!pricing) return null;
    const deliveryFee = subtotal > pricing.freeDeliveryOver ? 0 : pricing.deliveryFee;
    const tax = round(subtotal * pricing.taxRate);
    return { deliveryFee, tax, total: round(subtotal + deliveryFee + tax), toFreeDelivery: Math.max(0, round(pricing.freeDeliveryOver - subtotal)) };
  };
  return { pricing, estimate };
}
