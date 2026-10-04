// Where a customer goes after signing in: back to the page that sent them to /login.
// The destination comes from router state, so it is checked before use: it must be a page on this site,
// and never the sign-in page itself or the admin / delivery partner areas.
const NOT_FOR_CUSTOMERS = ["/login", "/admin", "/delivery-partner", "/delivery"];

export const CUSTOMER_HOME = "/account";

export function customerDestination(requested: unknown): string | null {
  if (typeof requested !== "string" || !requested.startsWith("/") || requested.includes("\\")) return null;
  let url: URL;
  try { url = new URL(requested, window.location.origin); } catch { return null; }
  // "//evil.com" and similar resolve to another origin.
  if (url.origin !== window.location.origin) return null;
  const path = url.pathname.toLowerCase();
  if (NOT_FOR_CUSTOMERS.some((area) => path === area || path.startsWith(area + "/"))) return null;
  return url.pathname + url.search + url.hash;
}
