# Notifications

Notifications use MongoDB, the existing JWT HTTP-only account cookies, and normal HTTP polling. No notification data is persisted in browser storage, and no WebSockets or background server timers are used.

## Using the feature

- Signed-in customers, admins, and delivery partners have a notification bell in their header.
- The bell displays the current account's unread count. Its panel supports reading individual notices, marking the visible page as read, dismissing individual notices, and viewing older pages.
- Clicking a linked notification marks it as read on the server before navigating. Failed reads leave the notice available and display an error.
- Admins can send broadcasts from **Settings → Notifications** (`/admin/settings?section=notifications`). Choose **All Customers** or **Everyone**, enter a title and message, select or enter a type, and optionally supply a local page path.

## Ownership and audience

`individual` requires both a recipient ID and a recipient account type. `customers` includes only customer accounts. `all` includes customers, the admin, and delivery partners.

Every query derives its identity from the relevant authenticated cookie. Supplying another user's ID cannot change the scope. The account type is part of the identity because the existing admin is an environment-backed account with ID `admin`, while customers and partners use MongoDB IDs.

`NotificationReceipt` stores each account's independent `readAt` and `dismissedAt`, with a unique index on notification/account type/account ID. Reading or dismissing a broadcast never changes another account's state or deletes the broadcast.

## APIs

Use the account-specific base path:

| Account | Base path |
| --- | --- |
| Customer | `/api/notifications` |
| Admin | `/api/admin/notifications` |
| Delivery partner | `/api/delivery/notifications` |

Each base path provides:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/` | Recent, incremental, or older notifications and unread count |
| GET | `/unread-count` | Current account's unread count |
| PATCH | `/:id/read` | Mark an authorized notification read |
| PATCH | `/read-all` | Mark only authorized IDs in the submitted `{ "ids": [...] }` visible page read |
| DELETE | `/:id` | Dismiss a notice for the current account |
| POST | `/broadcast` | Admin only; accepts title, message, audience, type, and optional link |

List parameters: `limit` defaults to 20 and is capped at 50; `page` supports conventional history pagination; `before` is the history sequence cursor; `since` is the incremental sequence cursor. `since` and `before` cannot be combined. Optional `known` IDs synchronize read/dismissal state for already displayed notices without returning the history again. The response includes `cursor`, `nextBefore`, `hasMore`, `states`, and `removedIds`.

The UI supplies `X-Notification-Owner` as an additional account-switch guard. The header does not grant authorization. A mismatched authenticated account receives 409. Mutation APIs retain the application's existing CSRF protections. Links must be local page paths and cannot contain credential or private-code query parameters.

## Polling and retention

The UI loads the latest 20 notices, then polls every five seconds after each completed request using `since`. Incremental backlogs are drained in bounded pages. Only the recent page and the displayed history page are retained in React memory. Hidden tabs pause polling; returning to a visible tab fetches immediately. Network failures preserve the displayed list and retry on the next interval. Logout aborts requests and removes polling listeners/timers. Responses from an old account or unmounted store are ignored.

Notification creation increments a durable sequence counter in the same MongoDB transaction as the notification and, where applicable, its business event. This prevents concurrently committed events from falling behind an already consumed polling cursor. The existing application already requires MongoDB Atlas or a replica set for transactions; startup initializes the counter and indexes.

Notifications and receipts expire after 90 days through MongoDB TTL indexes. Queries also exclude expired notices immediately, without waiting for asynchronous TTL cleanup. Audience, recipient, creation time, sequence, and receipt lookup indexes support the feed and unread-count queries.

## Existing event integrations

The reusable `backend/services/notifications.ts` service supports individual and broadcast notices with flexible type strings. It is connected to order placement, admin order status changes, customer and automatic cancellation, delivery assignment/reassignment and cancellation, delivery progress, successful cash payment, and delivery-partner applications. Order creation retries do not duplicate notifications, and rolled-back business transactions leave no notification behind.

The project has no separate manager role or inquiry submission flow. Existing admin permissions are reused; no new role or unrelated inquiry system has been introduced.

## Verification

Run `npm test` and `npm run build` in both `backend` and `frontend`, plus `npm run lint` in `frontend`.

The backend suite covers cookie authentication, private-ID access attempts, audience rules, independent broadcast receipts, concurrent reads, authorized visible-page reads, dismissals, link validation, incremental/history pagination, expiry, transactional ordering/rollback, order and delivery/payment events, and login persistence. Frontend tests cover polling, hidden tabs, errors, bounded history, cross-tab receipt updates, account switching, logout cleanup, and stale responses.

Verified during implementation: **97 backend tests and 17 frontend tests passed**, both production builds passed, and frontend lint passed. Interactive browser verification was unavailable in this environment.
