# Frontend review

Reviewed: 2 October 2026. Scope: frontend source, routes, state, customer/admin/delivery interactions, and local build checks. Backend inspection was limited to project structure; no backend changes were made.

## Current state

React 19, TypeScript, Vite, Tailwind CSS, React Router, and Leaflet. Screens exist for browsing, search, deals, product details, cart, checkout, addresses, orders, tracking, admin management, and delivery management. Most data comes from `src/assets/assets.ts`; no frontend API requests were found in the reviewed source. The cart persists to localStorage.

## Verification

- `npm run build`: failed with 21 TypeScript diagnostics. These include untyped component props, unused variables, an incorrect address state callback type, and order/delivery partner model mismatches.
- `npm run lint`: failed with 45 errors and 3 warnings across 26 files. Findings include explicit `any`, effects updating derived state, missing effect dependencies, a map component declared inside render, and the cart context export structure.
- Development server started successfully at `http://127.0.0.1:5174/` outside the sandbox after the sandbox blocked a required child process.
- Visual and interactive browser verification remains incomplete: agent-browser is not installed, and computer-use reports no connected browsers. Desktop/mobile layout, console behavior, images, and keyboard flows have not been verified visually.
- No automated test script is configured in the frontend package.

## Priority 1: establish a working frontend baseline

1. Resolve build and lint failures without weakening the TypeScript or lint rules. Start with `FilterPanel`, `RelatedProduct`, address callback types, and the order model.
2. Repair navigation in `layout/Footer.tsx`: `/flash-deals`, `/track-order`, `/account`, `/orders`, and `/addresses` have no corresponding routes in `App.tsx`. Delivery Partner also points to `/track-order`. Add a fallback route for unknown URLs.
3. Handle invalid IDs in product details and tracking. Both pages only stop loading when a matching fixture is found; invalid IDs can leave the loading screen indefinitely.
4. Make product pagination actually slice the filtered results. `pages/Product.tsx` calculates page counts and changes the URL but renders every filtered product on each page. The `organic` parameter is tracked but never applied to the data. Remove artificial loading delays and guard against stale filter results.
5. Unify cart and checkout pricing. Cart charges GHS 10 below/equal to GHS 100; checkout charges GHS 23 below/equal to GHS 150 and adds 10% tax. Their displayed totals disagree, and the wording says free delivery 'over' a threshold while the exact threshold still incurs a fee. Use shared pricing rules once the intended values are decided.

## Priority 2: complete customer interactions with shared demo state

1. Addresses: submit currently resets the form without saving; delete has an empty handler. Checkout reads a separate fixed address fixture. Use shared address state so add/edit/delete/default changes appear in checkout and persist as intended.
2. Checkout: placing an order only navigates after a timer; it never creates an order. Loading is immediately reset, allowing repeated submissions. Step buttons allow skipping forward. Validate the chosen address, keep submission state active, create a demo order, then clear the cart on success.
3. Orders: `MyOrders` renders fixed fixtures. Its effect depends on a newly recreated `clearCart` function, potentially retriggering loading whenever cart context renders. Cart clearing is triggered by a query parameter rather than a confirmed order result.
4. Account flow: Navbar always uses a hardcoded admin user. Customer login merely redirects; logout does not clear a session. `ProtectedRoute` always renders its outlet, and admin/delivery routes have no role guards. Establish consistent frontend demo session state; real authorization belongs to the later backend phase.
5. Inventory: product card add buttons and CartContext do not enforce availability or stock limits. Product details disable initial add for zero stock but quantity increments can exceed available stock. Enforce consistent quantity rules across entry points.
6. Cart persistence: unguarded JSON parsing can crash startup if saved cart data is malformed. Validate stored data and recover gracefully.

## Priority 3: admin and delivery interactions

- Admin product save and delivery partner creation handlers are empty.
- Marking products out of stock, changing order status, and toggling delivery partner availability only log values.
- Assigning a delivery partner displays success without updating an order.
- Delivery login has an empty submit handler; delivery layout selects a fixed partner.
- Delivery completion/cancellation close modals and reload unchanged fixtures; status updates only log values. The tracking toggle does not establish live location updates.
- Customer live location state is never updated, so the map cannot show a moving delivery partner.

Use one shared demo data source for products, orders, addresses, and partners before wiring these flows to backend APIs.

## Priority 4: usability and visual adjustments

- Mobile search is hidden below the small breakpoint and there is no alternate search entry in the navbar menu.
- Navbar uses z-index 100 while the cart/filter overlays use 50, allowing the navbar to appear above those overlays.
- Product cards navigate through a clickable div with no keyboard equivalent. Several icon buttons lack accessible names; form labels are not consistently associated with inputs.
- Cart and modal components need dialog semantics, focus handling, Escape behavior, and scroll handling.
- Currency formatting differs between screens; admin orders fall back to dollars while customer screens use GHS.
- Social links are placeholders; forgot-password and newsletter flows are not complete service integrations.
- Browser access is needed to validate mobile overflow, image loading, spacing, typography, contrast, and modal behavior before making design conclusions.

## Suggested adjustment sequence

1. Build/type/lint cleanup and broken navigation.
2. Product filtering, pagination, stock rules, and consistent cart totals.
3. Shared frontend demo state for account, addresses, checkout, and orders.
4. Complete admin/delivery demo actions.
5. Review desktop/mobile visuals and accessibility with a connected browser.
6. Begin backend integration after frontend behavior and intended business rules are settled.

Application source was not changed during this review.
