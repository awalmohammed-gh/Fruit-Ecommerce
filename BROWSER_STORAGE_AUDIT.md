# Browser storage audit

Audit performed before implementation on 2026-10-05. Searched the entire project for `localStorage`, `sessionStorage`, `getItem`, `setItem`, and `removeItem`, excluding dependencies and generated builds.

| Key | Existing use | Contents | Decision | Destination |
| --- | --- | --- | --- | --- |
| `app_cart` | `frontend/src/context/CartContext.tsx` | Product objects and quantities, shared across all users of a browser | Move; delete obsolete key | MongoDB cart owned by the customer authenticated through the existing HTTP-only cookie; React state for display |
| `greenfarm_partner_application_email` | `frontend/src/utils/partnerApplication.ts` | Applicant's private email | Remove persistence | In-memory state for this page visit |
| `greenfarm_partner_application_reference` | `frontend/src/utils/partnerApplication.ts` | Reference code that authorizes application lookup and account activation | Remove persistence | In-memory state; applicant enters their code again after refresh |
| `greenfarm_partner_application` | Legacy cleanup in `partnerApplication.ts` | Older application details including reference code | Remove | Delete obsolete key; do not restore it |
| `greenfarm.content` | `frontend/src/hooks/useSiteContent.ts` | Admin-controlled hero, banners, store details and other site settings | Move; delete obsolete key | Existing backend settings API, with an in-memory shared frontend cache |
| `greenfarm.session.customer`, `greenfarm.session.admin`, `greenfarm.session.partner` | Legacy cleanup in `frontend/src/frontApisRoute/session.ts` | Obsolete per-tab session IDs | Remove | Existing HTTP-only cookies and authenticated-user endpoints |
| `greenfarm_admin_low_stock` | `frontend/src/pages/admin/lib/settings.ts` | Display-only low-stock threshold | Keep | localStorage; never used for authorization or inventory writes |
| `greenfarm.driver.sidebar` | `frontend/src/pages/delivery/DeliveryLayout.tsx` | Sidebar collapsed/open preference | Keep | localStorage |
| `banner_dismissed` | `frontend/src/components/common/Banner.tsx` | Public announcement message dismissed for this browser session | Keep | sessionStorage; harmless display preference |

Authentication already uses separate HTTP-only customer/admin/partner cookies, authenticated-user endpoints, `credentials: "include"`, server-side session validation, and protected backend routes. No JWT, password, payment secret, API secret, or trusted authorization flag is currently written to browser storage. The frontend has only the public `VITE_API_URL` configuration reference. There is no separate manager permission system in this codebase; the existing admin and delivery partner guards remain authoritative.

The old browser cart has no authenticated owner, so it must not be automatically assigned to whichever customer signs in next. Cleanup deletes it without importing it. Safe preference keys are preserved. Cleanup runs before the app mounts and tolerates disabled browser storage.

## Implementation

- Added cookie-authenticated `GET /api/cart`, `POST /api/cart`, `PATCH /api/cart/:productId`, `DELETE /api/cart/:productId`, and `DELETE /api/cart` routes. MongoDB stores only the authenticated owner, product references, and validated quantities. Responses resolve current product data from the database.
- The frontend restores the cart on login/refresh, serializes requests, displays save/load errors, and ignores queued work or late responses from a previous account. The optional `X-Cart-Owner` header detects shared-cookie account changes; the backend always derives authorization from its verified customer session.
- A unique owner index and optimistic concurrency protect concurrent cart creation and changes. Existing order limits apply. Order creation clears the database cart in the existing stock/order transaction; the frontend then reloads it. An idempotent retry of an already-created order does not clear later additions.
- Delivery applicant email and reference code are kept in memory across client-side navigation only. Refresh/new tabs require manual re-entry. The application confirmation tells applicants to keep the code before refreshing.
- Site content comes from the existing backend API with an in-memory shared cache. Only harmless sidebar, low-stock display, and announcement-dismissal preferences continue writing to browser storage.
- Existing auth cookies, authenticated-user endpoints, server session revocation, admin guards, partner guards, and credentialed requests are reused. When another tab changes the customer session, the previous customer's frontend data is hidden while the current user is rechecked.

## Verification

- Backend: `npm test` — all 83 tests pass, including 9 new cart tests covering cookie restoration, logout/relogin, account isolation, rejected admin/partner credentials, stale owner headers, malformed input, concurrent additions, live pricing, and transactional checkout clearing.
- Storage migration: `npm test` in `frontend` — 3 tests cover precise key cleanup, preserved preferences, blocked storage, and in-memory application details.
- Backend and frontend builds and frontend ESLint pass. The production bundle still reports its existing large-chunk warning.
- Final storage scan shows only the three harmless preference writes plus obsolete-key cleanup. Frontend environment variable names were checked without printing values: only `VITE_API_URL` and `API_PROXY_TARGET` exist.
- Interactive browser checks could not run: `agent-browser` is not installed, browser inventory is empty, and opening an in-app browser returns `Browser is not available: iab`. Refresh/login/logout/cart isolation have automated API coverage; interactive visual behavior remains unverified.
