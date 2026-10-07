# Initial load performance audit (October 2026)

Why the GreenFarm storefront took several seconds to show content, what was changed, and the measured effect.

## How it was measured

- **Production:** https://fruit-ecommerce-two.vercel.app, measured with curl and with Edge driven by Playwright.
  The browser runs used a mobile viewport, a "slow 4G" network (150 ms latency, 1.6 Mbps down) and a 4x CPU slowdown.
  Each figure is the median of three runs with an empty cache.
- **Before and after:** both production builds of the frontend ran on the same machine, behind a server that
  compresses and caches the way Vercel does. They used the same throttling and the same API, an in-memory copy of the
  live catalogue. Production itself still runs the old code until these changes are deployed.
- **Cold start:** the database startup was timed against the Atlas cluster (AWS Paris, free M0 tier).

## Audit: what delays the first render

| Severity | Finding | Evidence |
|---|---|---|
| Critical | **Cold starts run about 27 sequential database round trips before the first response.** Every new function instance checked each model's indexes and ran the data migrations before serving. | First request after inactivity: 5.9 s. The next request: 0.67 s. The database setup alone took 4.5 s from the test machine. |
| Critical | **The API function runs in Washington DC (iad1), but the database is in Paris.** Shoppers reach the site through Africa. Every query crosses the Atlantic, and so does every API call. | `x-vercel-id: cpt1::iad1`. A health check that never touches the database still takes 0.5 s. Each database round trip costs about 80 ms from iad1. |
| Critical | **One 1,065 KB script (301 KB compressed) holds the whole app,** including the admin dashboard, the delivery partner area and the Leaflet map library. No API call starts until it has downloaded and run. | API requests start at 4.4 s in production. First paint is at 3.5 s. |
| High | **The hero picture is found late and is large.** It is a 2400 px, 214 KB JPEG. It can only start downloading after the script has run and the content request has returned. | LCP is the hero image: about 10 s throttled. |
| High | **Nothing public is cached.** Every API response is `no-store`, so each visit runs the function and queries MongoDB, even for content that changes a few times a week. | `X-Vercel-Cache: MISS` on `/api/content` and `/api/categories`. |
| High | **Catalogue pictures are 432 px PNGs on raw.githubusercontent.com,** at 80–160 KB each, shown at 75–155 px. Cloudinary only resizes pictures stored on Cloudinary, and its "fetch" mode is disabled on this account. | 10 hidden navbar and mobile-menu pictures loaded on every page, competing with the hero. |
| Medium | **Fonts come through a CSS `@import` from Google,** a chain of three requests across two extra origins. | Stylesheet, then the fonts.googleapis.com CSS, then fonts.gstatic.com files. |
| Medium | **Requests the first screen doesn't need:** delivery pricing was fetched on every page for the closed cart drawer, and categories were refetched on every window focus. | `/api/orders/pricing` was in every startup waterfall. |
| Minor | The announcement bar appears after the content loads and pushes the page down. | CLS 0.033. |
| Minor | Product lists returned descriptions and search-engine fields that cards never show. Popular, deals and category sorts had no matching indexes. | Small today (27 products), but these grow with the catalogue. |

What was checked and found fine:

- **Admin and partner sessions:** these are only checked on admin and partner pages. The storefront never waits for them.
- **Shared requests:** site content and categories are already fetched once and shared by the navbar, homepage and footer.
- **Compression:** Vercel already serves Brotli for the HTML, JavaScript, CSS and JSON.
- **Hashed assets:** files with a content hash already have a one-year immutable cache.
- **Product cards:** they already lazy-load their pictures and reserve the picture's space.

## Changes

**Backend and hosting**

- **Cold starts:** the serverless entry only connects and checks the replica set before serving. Automatic index
  building and collection creation are off on that path. Index checks and migrations now run in parallel, once
  per instance, after the first response has been sent. The same goes for the order sweep. The long-running server and
  the tests still wait for the full setup (`connectDatabase`). Files: `backend/config/database.ts`, `backend/serverless.ts`.
- **Region:** functions are pinned to Paris (`"regions": ["cdg1"]` in `vercel.json`), next to the database.
- **CDN caching for public data:** content and categories are cached for 60 s, page metadata for 5 min, and pricing
  rules for 1 h. Each is then refreshed in the background, and browsers revalidate on every load. Nothing that depends on
  a sign-in is cached. After an admin save, the admin's own tab asks for a fresh copy, so they see the change at once.
  Other shoppers see it within a minute. Files: `backend/middleware/cache.ts`, the four public controllers.
- **Smaller payloads:** storefront product lists ask for `view=card` and get only the card fields. The public category
  list returns only the name, slug, picture and description.
- **Indexes** for the actual sorts: popular (rating), Flash Deals (discount), and a category's newest products.

**Frontend**

- **Code splitting:** only the store layout and the home page are in the first download. Every other page loads on
  first visit, with a skeleton in the page area while the header and footer stay. The pages shoppers usually open next
  are fetched in the background a few seconds after the page has loaded.
- **Startup data preloaded from the HTML:** content, session and categories now start downloading at the same time as
  the script, not after it has run. A small Vite plugin adds the tags. Each response is used once; there are no
  duplicate requests.
- **Self-hosted fonts:** Outfit (variable) and DM Serif Display ship with the app through `@fontsource`.
- **Images:**
  - The hero and banner pictures have WebP copies. The hero went from 214 KB to 113 KB and the van from 201 KB to 22 KB.
  - Later hero slides wait until the first picture has loaded.
  - Menu pictures load only when a menu is opened.
  - Banner, ad, cart and filter pictures go through the resize helper.
- **Smaller fixes:**
  - Pricing loads when the cart is first opened.
  - The category refetch on window focus happens at most once a minute.
  - The announcement bar keeps its space while content loads.
  - Deals pages load in parallel.

## Results

Same build server and API, throttled mobile, first visit, median of three runs:

| Metric | Before | After |
|---|---|---|
| First paint (FCP) | 3.7 s | 2.5 s |
| Largest paint (LCP, the hero picture) | 10.1 s | 5.0 s |
| Layout shift (CLS) | 0.033 | 0.001 |
| JavaScript downloaded | 239 KB | 153 KB |
| Bytes transferred | 1,478 KB | 1,112 KB |
| Startup API calls | 6, after the script ran | 3 preloaded with the HTML, 2 after the script |

Production build output:

| Asset | Before | After |
|---|---|---|
| Entry script | 1,065 KB (301 KB gzip) | 478 KB (151 KB gzip) |
| Main stylesheet | 199 KB (40 KB gzip) | 92 KB (16 KB gzip) |
| Admin, delivery partner and map code | in the entry script | separate files, downloaded only when used |

Server side, timed from the test machine (about 125 ms from Paris):

| Step | Before | After |
|---|---|---|
| Cold start until a request is served | 4.5 s | 1.7 s |

From the Paris region, each of those round trips takes a few milliseconds instead of about 80 ms. Cached
content and categories are then served by the CDN without running the function.

Repeat visits were already fast at about 1 s LCP, because the hashed files are cached, and they stay about the same.

## After deploying, verify

```
curl -sI https://fruit-ecommerce-two.vercel.app/api/content | grep -iE "x-vercel-id|x-vercel-cache|cdn-cache-control"
```

`x-vercel-id` should show `::cdg1::`, and a second request should show `X-Vercel-Cache: HIT`.

## Remaining opportunities

- **Move the catalogue pictures to Cloudinary.** This is the largest remaining image cost: about 145 KB per card,
  which becomes about 23 KB once resized. The script below copies the 27 externally hosted pictures and updates the
  records. It changes nothing unless `--apply` is given. Check which database `backend/.env` names first.
  ```
  cd backend
  npx tsx scripts/moveImagesToCloudinary.ts          # dry run
  npx tsx scripts/moveImagesToCloudinary.ts --apply
  ```
- **The animation library** (`motion`) is about 130 KB of the entry script. Switching the storefront to `LazyMotion`
  with `m` components would defer most of it. That touches every animated component, so it was left out here.
- **The free M0 Atlas tier** is shared and throttled. A dedicated tier in the same region would lower query time further.
