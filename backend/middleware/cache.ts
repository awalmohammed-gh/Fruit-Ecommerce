import type { Response } from 'express';

/**
 * Marks a successful response as public data that is the same for every visitor (no cookies involved), so the
 * hosting CDN may keep one shared copy instead of every visit running the function and querying MongoDB.
 *
 * Browsers still check back on every load (max-age=0) and get a cheap 304 when nothing changed. The CDN serves its
 * copy for `seconds`, then keeps serving it while it fetches a fresh one in the background, so an admin change
 * reaches shoppers within about `seconds`. Call it just before sending a 200: errors are never marked cacheable.
 * Never use it for anything that depends on who is signed in (cart, orders, account, admin data).
 */
export function sharedCache(res: Response, seconds: number) {
  res.set('Cache-Control', 'public, max-age=0, must-revalidate');
  res.set('CDN-Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=86400`);
}
