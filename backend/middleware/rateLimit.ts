import type { RequestHandler, Response } from 'express';
import RateLimit from '../models/RateLimit.js';
import { HttpError } from './errors.js';

const WINDOW_MS = 15 * 60_000;

/**
 * Fixed-window counters stored in MongoDB (see models/RateLimit.ts), so restarts don't reset them and
 * several API instances share them. Every limiter has its own name, so each sign-in endpoint has its own
 * budget and failed logins never use up a shopper's sign-up attempts.
 */
class Counter {
  constructor(private name: string, private max: number, private windowMs = WINDOW_MS) {}
  private key(id: string) { return `${this.name}:${id}`; }

  /** Counts one more, starting a new window when the last one has ended. Returns the count and when it resets. */
  async add(id: string): Promise<{ count: number; expiresAt: Date }> {
    const now = new Date();
    const fresh = new Date(now.getTime() + this.windowMs);
    const live = { $gt: ['$expiresAt', now] };
    // One atomic update: add one inside a live window, otherwise start again at 1.
    const update = [{ $set: {
      count: { $cond: [live, { $add: ['$count', 1] }, 1] },
      expiresAt: { $cond: [live, '$expiresAt', fresh] },
    } }];
    for (let attempt = 0; ; attempt++) {
      try {
        const entry = await RateLimit.collection.findOneAndUpdate({ key: this.key(id) }, update, { upsert: true, returnDocument: 'after' });
        return { count: entry!.count as number, expiresAt: entry!.expiresAt as Date };
      } catch (error) {
        // Two first requests at once: one creates the counter, the other retries and counts on it.
        if ((error as { code?: number }).code !== 11000 || attempt > 0) throw error;
      }
    }
  }
  /** Seconds until `id` may try again; 0 while it is under the limit. */
  async waitFor(id: string) {
    const entry = await RateLimit.findOne({ key: this.key(id), expiresAt: { $gt: new Date() } }).lean();
    return entry && entry.count >= this.max ? Math.ceil((entry.expiresAt.getTime() - Date.now()) / 1000) : 0;
  }
  async clear(id: string) { await RateLimit.deleteOne({ key: this.key(id) }); }
}

function tooMany(res: Response, seconds: number, message: string) {
  res.set('Retry-After', String(Math.max(1, seconds)));
  return new HttpError(429, message);
}

/**
 * At most `max` requests per IP address every 15 minutes, for the endpoint `name`. Behind a proxy, set
 * TRUST_PROXY so the address is the visitor's rather than the proxy's.
 */
export function perIp(name: string, max: number): RequestHandler {
  const counter = new Counter(`ip:${name}`, max);
  return async (req, res, next) => {
    const entry = await counter.add(req.ip || 'unknown');
    if (entry.count > max) throw tooMany(res, Math.ceil((entry.expiresAt.getTime() - Date.now()) / 1000), 'Too many attempts. Please try again later.');
    next();
  };
}

/**
 * Failed attempts against one thing (an account's email, a delivery's code), however many addresses they
 * come from. After `max` failures in 15 minutes it is locked until the window ends; a success clears it.
 */
export function failureLock(name: string, max: number, message: (minutes: number) => string) {
  const counter = new Counter(`fail:${name}`, max);
  return {
    async check(res: Response, id: string) {
      const seconds = await counter.waitFor(id);
      if (seconds) throw tooMany(res, seconds, message(Math.ceil(seconds / 60)));
    },
    fail: async (id: string) => { await counter.add(id); },
    clear: (id: string) => counter.clear(id),
  };
}
export const signInLock = (name: string, max: number) => failureLock(name, max, (minutes) => `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
