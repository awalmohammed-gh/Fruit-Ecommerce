# GreenFarm API

This backend uses TypeScript, ES modules, Express, MongoDB/Mongoose, bcryptjs, and JWT sign-ins in HTTP-only cookies backed by server-side session records (see Sessions below). Every screen in the storefront, admin and delivery portal reads from it; there is no sample or seed data. Payments are cash on delivery; card payments need a payment provider, which is not connected.

## Run

1. Install dependencies with `npm install` in `backend` and `frontend`.
2. Keep your existing `backend/.env`, or copy `.env.example` to `.env` for a new setup.
3. Set `MONGODB_URI` and `JWT_SECRET_KEY` (at least 32 characters). MongoDB Atlas or a local replica set is required for transactions. Generate a secret with `node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(48).toString('hex'))"`.
4. Run `npm run dev` in the backend, then `npm run dev` in the frontend. The default API port is 5000 and frontend port is 5174.

The frontend uses `src/frontApisRoute` for all user/address API calls. Requests include credentials, so JavaScript never reads or stores the authentication token. Vite proxies `/api` to `http://localhost:5000`. Set `API_PROXY_TARGET` in `frontend/.env` if the API port differs. In production, proxy `/api` to the backend, or set `VITE_API_URL` to the API URL.

Set `CLIENT_ORIGIN` to a comma-separated list of exact allowed frontend origins (a `*` is refused). Production (`NODE_ENV=production`) uses `Secure` cookies and requires HTTPS, and adds HSTS. Serve the storefront and API from the same site (the same origin through a proxy, or subdomains such as `www.` and `api.` of one domain) and keep `COOKIE_SAME_SITE=lax`; set `COOKIE_DOMAIN` only if the cookies must be shared across subdomains. Use `COOKIE_SAME_SITE=none` only for truly cross-site hosting; it requires HTTPS. Behind a proxy (Render, Railway, Nginx, Cloudflare), set `TRUST_PROXY` to the number of proxies, usually `1`, so rate limits see each visitor's address instead of the proxy's.

CSRF: the sign-in cookies are SameSite, every change (`POST`, `PUT`, `PATCH`, `DELETE`) must carry `X-GreenFarm-Request: true`, and only the allowed origins pass CORS. Another site can't add that header without a preflight that the origin check refuses, so a forged form or script request never runs with a visitor's cookies. `GET` requests never change data.

Rate limits: each sign-in endpoint (customer, admin and partner login, register, password change, partner application, status check, activation and the delivery code) allows 20 requests per IP every 15 minutes, each with its own budget. Five failed sign-ins lock that account for 15 minutes whatever address they come from, and five wrong delivery codes lock that delivery for 15 minutes. The counters are stored in MongoDB (`RateLimit`, removed automatically when their window ends), so restarts don't reset them and every API instance shares them.

Security headers: every response sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and a Content Security Policy (API responses: nothing may load or frame them; storefront pages served with `STOREFRONT_DIST`: the app's own scripts only, plus Google Fonts and HTTPS images).

## Routes

| Method | Route | Action |
| --- | --- | --- |
| POST | `/api/auth/register` | Customer: create account and sign in (sets `customerToken`) |
| POST | `/api/auth/login` | Customer: sign in (customers only; the admin credentials are refused here) |
| POST | `/api/auth/logout` | Customer: sign out (ends this sign-in, clears only `customerToken`) |
| GET | `/api/auth/me` | Customer: restore sign-in (`user: null` when signed out) |
| POST | `/api/auth/admin/login` | Admin: sign in with `ADMIN_EMAIL` / `ADMIN_PSD` |
| POST | `/api/auth/admin/logout` | Admin: sign out (clears only `adminToken`) |
| GET | `/api/auth/admin/me` | Admin: restore sign-in (`admin: null` when signed out) |
| PATCH | `/api/auth/profile` | Update fullName, phone, avatar |
| PATCH | `/api/auth/profile/avatar` | Customer: upload own JPG, PNG or WebP photo through Cloudinary (multipart `image`, 5 MB max) |
| DELETE | `/api/auth/profile/avatar` | Customer: remove own profile photo |
| PATCH | `/api/auth/preferences` | Customer: save default market sorting and in-app notification preferences |
| PATCH | `/api/auth/password` | Verify currentPassword and set newPassword |
| GET | `/api/addresses` | List your addresses |
| POST | `/api/addresses` | Add address |
| GET | `/api/addresses/:id` | Get your address |
| PATCH | `/api/addresses/:id` | Edit your address |
| DELETE | `/api/addresses/:id` | Delete your address |
| PATCH | `/api/addresses/:id/default` | Select your default |
| GET | `/api/products` | Public catalogue: `q`, `category`, `organic`, `inStock`, `minPrice`, `maxPrice`, `sort`, `page`, `limit` |
| GET | `/api/products/:id` | Public product details, by readable slug (`cheese-200g`) or database ID |
| POST | `/api/products` | Admin: add product |
| PATCH | `/api/products/:id` | Admin: edit product |
| DELETE | `/api/products/:id` | Admin: delete product |
| GET | `/api/products/stats` | Admin: product counts, low/out of stock, stock value (`lowStockBelow`) |
| GET | `/api/categories` | Public: categories with product counts, plus slugs used by products without a record |
| POST | `/api/categories` | Admin: add category (`name`, optional `slug`, `image`) |
| PATCH | `/api/categories/:id` | Admin: rename or change image (slug is fixed) |
| DELETE | `/api/categories/:id` | Admin: delete a category no products use |
| GET | `/api/admin/customers` | Admin: list customers (`q`, `status`, `page`, `limit`) |
| GET | `/api/admin/customers/stats` | Admin: total, active, inactive, joined this month |
| GET | `/api/admin/customers/:id` | Admin: customer with saved addresses |
| PATCH | `/api/admin/customers/:id/status` | Admin: activate or deactivate (deactivating signs them out) |
| POST | `/api/admin/uploads/image` | Admin: upload an image to Cloudinary (multipart field `image`, 2 MB max; `?folder=content` for hero and banner images) |
| GET | `/api/seo?path=` | Public: title, description, canonical, robots, sharing tags, structured data and status (200/404) for a storefront address |
| GET | `/sitemap.xml` | Public: homepage, shop, deals, active categories and every product, built from the database |
| GET | `/robots.txt` | Public: keeps crawlers out of private areas and points to the sitemap |
| GET | `/api/content` | Public: storefront content - hero slides, announcement, section text, ads, store details and live banners (active content only) |
| GET | `/api/admin/content` | Admin: all storefront content, inactive parts included |
| PUT | `/api/admin/content/:block` | Admin: replace one block: `hero`, `store`, `announcement`, `sections` or `ads` |
| GET | `/api/admin/banners` | Admin: every promotional banner, newest change first |
| POST | `/api/admin/banners` | Admin: add a banner (starts inactive unless `active: true`) |
| PUT | `/api/admin/banners/:id` | Admin: replace a banner |
| PATCH | `/api/admin/banners/:id/status` | Admin: enable or disable (`active`) |
| DELETE | `/api/admin/banners/:id` | Admin: delete a banner |
| GET | `/api/products/:id/reviews` | Public: reviews, average and star breakdown (`page`) |
| GET | `/api/products/:id/reviews/mine` | Customer: whether they may review, and their review |
| POST | `/api/products/:id/reviews` | Customer: write or update their review (`rating` 1–5, `comment`) |
| GET | `/api/orders/pricing` | Public: delivery fee, free-delivery threshold and tax rate |
| POST | `/api/orders/quote` | Public: price a cart (`items: [{ productId, quantity }]`) and report stock problems |
| POST | `/api/orders` | Customer: place an order (`addressId`, `paymentMethod: "cash"`, `items`) |
| GET | `/api/orders` | Customer: their orders |
| GET | `/api/orders/:id` | Customer: one of their orders, with the delivery code while a rider is on the way |
| POST | `/api/orders/:id/cancel` | Customer: cancel while the order is Order Placed or Confirmed |
| GET | `/api/admin/orders` | Admin: orders (`stage`, `q`, `payment`, `page`, `limit`) with stage counts |
| GET | `/api/admin/orders/summary` | Admin: orders by status and revenue for today, this week and this month vs the previous period |
| GET | `/api/admin/orders/revenue` | Admin: revenue per day (14), week (12) or month (12) (`granularity`) |
| GET | `/api/admin/orders/products` | Admin: units and revenue per product, with live stock |
| GET | `/api/admin/orders/:id` | Admin: one order |
| PATCH | `/api/admin/orders/:id/status` | Admin: change status (Delivered and Cancelled are final) |
| PATCH | `/api/admin/orders/:id/partner` | Admin: assign or reassign a confirmed order (`partnerId`, optional `notes`); earlier attempts are kept |
| GET | `/api/admin/delivery/applications` | Admin: applications (`status`, `q`, `page`) with counts per status |
| GET | `/api/admin/delivery/applications/:id` | Admin: everything an applicant submitted, review history and workload |
| PATCH | `/api/admin/delivery/applications/:id/status` | Admin: Pending → Approved/Rejected, Approved → Suspended, Suspended → Approved (`status`, optional `reason`) |
| GET | `/api/admin/delivery/partners` | Admin: approved and suspended partners with active/completed deliveries (`available=true`: only those who can take one now) |
| GET | `/api/admin/delivery/assignments` | Admin: delivery tracking (`status` = assigned, picked-up, on-the-way, delivered, failed or closed; `q`; `page`) |
| GET | `/api/admin/delivery/assignments/:id` | Admin: one delivery with its timeline and every attempt on the same order |
| POST | `/api/delivery/application` | Public: apply (no customer account). Always saved as Pending; returns a one-time reference code |
| POST | `/api/delivery/application/status` | Public: application status by `email` + `reference` |
| POST | `/api/delivery/activate` | Public: approved applicant sets their password (`email`, `reference`, `password`) and is signed in |
| POST | `/api/delivery/login` | Partner: sign in (approved, activated and active accounts only) |
| POST | `/api/delivery/logout` | Partner: sign out |
| GET | `/api/delivery/me` | Partner: restore sign-in (`partner: null` when signed out) |
| POST | `/api/admin/delivery/applications/:id/activation-code` | Admin: new reference code for an approved applicant who lost theirs |
| GET/PATCH | `/api/delivery/profile` | Partner: view, or update phone, location, availability and emergency contact |
| GET | `/api/delivery/summary` | Partner: assigned, in progress, completed and today counts |
| GET | `/api/delivery/deliveries` | Partner: their open deliveries, or `view=history` with `status`, `from`, `to`, `page` |
| PATCH | `/api/delivery/deliveries/:id/status` | Partner: Assigned → Accepted → Picked Up → On The Way, one step at a time |
| POST | `/api/delivery/deliveries/:id/decline` | Partner: turn down a delivery they haven't accepted (optional `reason`) |
| POST | `/api/delivery/deliveries/:id/fail` | Partner: report a failed attempt (`reason` from the fixed list, `note`) |
| POST | `/api/delivery/deliveries/:id/deliver` | Partner: complete with the customer's 6-digit code (`otp`) |
| PATCH | `/api/delivery/deliveries/:id/location` | Partner: share `lat`/`lng` once the order is picked up |

All profile/address ownership comes from the verified cookie. User, role, isActive, password, email and ID fields supplied to a profile update are never applied. Passwords use bcrypt (12 rounds), minimum 8 characters, maximum 72 UTF-8 bytes. Password changes revoke other sessions by incrementing a token version. Avatar updates can use the existing HTTPS URL profile field or the authenticated Cloudinary photo upload endpoint. Customer settings and preference behavior are documented in [CUSTOMER_SETTINGS.md](../CUSTOMER_SETTINGS.md).

Address fields: `label`, `fullName`, `phone`, `addressLine1`, `addressLine2`, `city`, `region`, `digitalAddress`, `landmark`, `country`, `isDefault`. Label, receiver name, phone, address line 1, city and region are required. Country defaults to Ghana; digital address is optional. Any descriptive label is allowed. The region must be one of Ghana's 16 regions.

The user document holds a single default-address ID; the API derives each address's `isDefault` from it. Transactions serialize address mutations per user, including concurrent first-address creation and default changes. Deleting a default selects the earliest remaining address; deleting the last clears the pointer. Address mutations return the complete saved list to keep the client synchronized.

Product fields: `name`, `description`, `price`, `originalPrice`, `image`, `category`, `unit`, `stock`, `isOrganic`. The server always calculates `discount` from `originalPrice` and `price` (140 → 130 is 7%). The API ignores any discount, rating, review count, ID or timestamp the client sends. Leave out `originalPrice` (or send `null`) when a product is not on sale; it is then stored equal to `price`. When you change the price of a product that is on sale, the original price stays the same. When you change the price of a product that is not on sale, the original price changes to match. Categories are lowercase slugs such as `dairy-eggs` and are not a fixed list. Stock is a whole number of zero or more, and a product with no stock stays in the catalogue. `sort` accepts `newest` (default), `price_asc`, `price_desc`, `rating`, `name`, `updated`, `stock_asc` and `discount`. `stock` filters by `in`, `low`, `out` or `restock` (below `lowStockBelow`, default 10); `organic` accepts `true` or `false`; `onSale=true` lists discounted products. Pages default to 12 products (maximum 48). Only the admin can add, edit or delete products. The admin is not a database user: sign in at `/admin/login` (`POST /api/auth/admin/login`) with exactly `ADMIN_EMAIL` and `ADMIN_PSD` from `.env` (password at least 8 characters). The customer login refuses these credentials. Nobody can register an account with that email, a `role` field in MongoDB grants nothing, and changing either value signs out existing admin sessions.

Sessions: each account type signs in with its own JWT in its own HTTP-only cookie: `customerToken`, `adminToken` and `deliveryPartnerToken` (path `/api`, `SameSite` from `COOKIE_SAME_SITE`, `Secure` in production). The token is never in a response body and the storefront never stores one; it sends the cookies with `credentials: "include"`. A token holds only the account ID (`sub`), the account type (as the audience) and a random token ID, and it is signed with a separate key per account type (`JWT_CUSTOMER_SECRET`, `JWT_ADMIN_SECRET`, `JWT_PARTNER_SECRET`, or keys derived from `JWT_SECRET_KEY`), so a token never works in another type's cookie. The middleware `customerAuth`, `adminAuth` and `deliveryPartnerAuth` each read only their own cookie, verify the token (HS256, audience, issuer, expiry), check its `Session` record (only a hash of the token ID is stored) and load the account fresh from the database, attaching `req.user`, `req.admin` or `req.deliveryPartner`. Customer and partner sign-ins last 7 days. The admin's lasts 12 hours and also ends after 30 minutes without a request. Signing out deletes that one session and clears only that cookie; changing a password, deactivating a customer or suspending a partner deletes all of that account's sessions, so stolen tokens stop working at once. A 401 includes `account` and clears that cookie, so the browser signs out only that area. One browser can be signed in as a customer, the admin and a partner at the same time, but as only one account of each type: signing in as someone else in another tab switches every tab.

Orders: prices, delivery fee and tax always come from the database and `config/pricing.ts` (free delivery over GHS 150, otherwise GHS 23; 10% tax), never from the browser. Placing an order copies the customer's saved address and the product details onto the order, and reserves stock in a transaction so the last unit can't be sold twice. Cancelling (by the customer or admin) returns the stock exactly once and closes any open delivery. Each order gets a 6-digit delivery code that only the customer sees, and only while a rider is on the way; the rider must enter it to mark the order delivered, which also marks cash as paid. Delivery partners are their own accounts (`DeliveryPartner`), separate from customer `User`s: anyone can apply without a GreenFarm account, management approves them, and they activate with the email and reference code from their application, choosing a password that is stored hashed. They sign in at `/api/delivery/login` with their own cookie (`deliveryPartnerToken`), which is never accepted as a customer or admin session, and every request re-checks that the account is approved, activated and active, so suspending someone signs them out at once. Each assignment is its own record (`DeliveryAssignment`) with a step history; reassigning closes the old one as Reassigned instead of overwriting it. Order status (Packed, Assigned, Out for Delivery, Delivered) follows the delivery automatically, while payment (`isPaid`) and the delivery status (`deliveryStatus`) are stored separately. A failed or declined delivery sends the order back to Packed for management to reassign. Revenue figures exclude cancelled orders and use UTC calendar periods (Ghana time).

Order limits (`config/orderLimits.ts`): an order can hold at most 20 of any one product, and a customer can have at most 3 orders waiting for confirmation ("Order Placed") at once. Orders GreenFarm hasn't confirmed within 24 hours are cancelled automatically every 15 minutes (`cancelUnconfirmedOrders`, started by `server.ts`), with the reason on the order and their stock put back on sale. Checkout sends an `Idempotency-Key` header (a random ID per checkout visit): sending the same checkout again, or twice at once, returns the first order instead of creating another.

Re-applying: a rejected delivery partner applicant may apply again with the same email. That creates a new application linked to the old one (`previousApplication`); the rejected application is kept unchanged and marked `replaced`, so nobody who knows an applicant's email can rewrite their application. Only one live application per email is allowed.

Storefront content (Admin → Settings): one `SiteContent` document holds the hero (`mode` single or slider, `autoplaySeconds`, the `single` hero and up to 6 `slides` in display order), the announcement bar, store details for the footer, homepage section text and the two ad sections; promotional banners are separate `Banner` records with a `placement` (`home-top`, `home-middle`, `home-bottom`, `products`, `category`), an optional category and optional start/end dates. The first read creates the document and the starting banner from `config/siteDefaults.ts` (the original home page wording); after that the database is the only source and deleted banners are not re-created. Links must be a page on the site (`/products`), a home page section (`#categories`) or an http(s) address; images must be HTTPS or a file served by the storefront (`/content/...`). A button needs both its text and its link. `GET /api/content` returns only active slides, ads and banners whose dates include now.

SEO: `services/seo.ts` is the single place that decides each storefront page's metadata from the database: title, description, canonical URL, robots rule, Open Graph and X tags, and JSON-LD (Organization and WebSite on the homepage, Product with Offer in GHS and, only when real reviews exist, AggregateRating on products, CollectionPage on categories, BreadcrumbList on both). Products have a readable `slug` made from the name when they are created; it is kept when the product is renamed so links never break, and old ID links still open the product and point search engines at the slug address. Products and categories have optional `seoTitle`/`seoDescription` (categories also `seoImage`); empty fields fall back to `Name | Site name` and the cleaned description. Site name, homepage title, default description and default sharing image are in Admin → Settings → Search & sharing (`PUT /api/admin/content/seo`). Filtered, sorted and search-result pages are `noindex,follow` with a canonical link to the plain page; later pages of a list are their own canonical pages; the old `/products?category=` address points at `/category/:slug`. Sign-in, cart, checkout, account, orders, addresses, admin and delivery partner pages are `noindex,nofollow` and listed in robots.txt; API responses carry `X-Robots-Tag: noindex`. Unknown addresses, deleted products and disabled categories are 404. The storefront fetches `/api/seo` on every navigation. Because link previews (WhatsApp, Facebook, LinkedIn, X) don't run JavaScript, set `STOREFRONT_DIST` to the built frontend to have this server send each page with its tags already in the HTML and with real 404 statuses; otherwise, have your static host forward `/api`, `/sitemap.xml` and `/robots.txt` to this server. Set `PUBLIC_SITE_URL` to the storefront's public address in production.

Reviews: only customers with a delivered order containing the product can review it, once per product (writing again updates it). A product's `rating` and `reviewCount` are recalculated from its reviews on every change, and deleting a product deletes its reviews.

## Checks

`npm run build` compiles the backend. `npm test` runs the API integration tests against a temporary MongoDB replica set, including two-user ownership, hashing, cookies, profile field protection, password changes, default switching and deletion. The first test run downloads a MongoDB binary; it does not use or modify your configured database.


## Personal admin settings

Account and Preferences are stored in the dedicated AdminSettings collection, keyed to the configured admin email. Session ownership determines every update; profile edits cannot change the email, role, permissions or active status. Profile photos reuse the existing admin image upload endpoint. Preferences affect management lists, navigation and display formatting without modifying storefront configuration or GHS prices. Light and Dark themes are supported; System follows the device appearance and responds to changes while the workspace is open. Notification controls remain unavailable until notification delivery is supported.

ADMIN_EMAIL and ADMIN_PSD bootstrap sign-in. A password changed in Account settings is stored as a bcrypt hash, replaces the bootstrap password and revokes other admin sessions. Rotating the configured credentials provides password recovery: it invalidates the saved password override and existing sessions while retaining that email's profile and preferences. Restart the backend after changing environment credentials.
