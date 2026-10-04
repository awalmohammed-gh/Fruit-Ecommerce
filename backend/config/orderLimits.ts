// Limits that stop one shopper tying up the store's stock with orders nobody confirms.
// The storefront mirrors maxPerProduct (frontend/src/utils/orderLimits.ts); the API enforces all three.
export const orderLimits = {
  // Units of any one product in a single order.
  maxPerProduct: 20,
  // Orders a customer may have waiting for GreenFarm to confirm ("Order Placed") at the same time.
  maxAwaitingConfirmation: 3,
  // Orders still unconfirmed after this long are cancelled automatically and their stock goes back on sale.
  confirmWithinHours: 24,
} as const;
