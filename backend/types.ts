import type { UserDocument } from './models/User.js';
import type { DeliveryPartnerDocument } from './models/DeliveryPartner.js';
import type { AccountType } from './models/Session.js';
import type { AdminProfile } from './middleware/auth.js';
export interface AppConfig {
  // JWT_SECRET_KEY. Signs the sign-in tokens (through a separate key per account type) unless jwtSecrets has one.
  jwtSecret: string;
  // JWT_CUSTOMER_SECRET / JWT_ADMIN_SECRET / JWT_PARTNER_SECRET, when set.
  jwtSecrets: Partial<Record<AccountType, string>>;
  origins: string[];
  // Sign-in cookies: Secure (HTTPS only, in production), SameSite, and an optional shared domain (COOKIE_DOMAIN).
  secureCookies: boolean; sameSite: 'lax' | 'strict' | 'none'; cookieDomain: string | null;
  // TRUST_PROXY: how many proxies are in front of the API, so rate limits see the visitor's address.
  trustProxy: number | string | false;
  // Requests per IP per 15 minutes on each sign-in endpoint, and failed sign-ins per account before a lockout.
  authLimit: number; loginLockout: number;
  // From ADMIN_EMAIL / ADMIN_PSD. The admin is never stored in the database.
  admin: { email: string; password: string } | null;
  // The storefront's public address (PUBLIC_SITE_URL), used for canonical links, sharing tags and the sitemap.
  siteUrl: string;
  // Built storefront to serve with page metadata in the HTML (STOREFRONT_DIST); null when it's hosted elsewhere.
  storefrontDist: string | null;
}
declare global {
  namespace Express { interface Request { user: UserDocument; admin: AdminProfile; deliveryPartner: DeliveryPartnerDocument } }
}
