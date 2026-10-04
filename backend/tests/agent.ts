import request from 'supertest';
import type { Express } from 'express';

// Behaves like one browser: keeps the sign-in cookies each response sets and sends them back,
// the way the storefront does with credentials: "include".
export const browser = (app: Express) => request.agent(app);

/** The value of a cookie a response set, e.g. customerToken. */
export function cookieFrom(response: { headers: Record<string, unknown> }, name: string) {
  const cookies = (response.headers['set-cookie'] ?? []) as string[];
  const line = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return line ? decodeURIComponent(line.slice(name.length + 1).split(';')[0]!) : null;
}
/** A raw Cookie header, for sending a token somewhere it doesn't belong. */
export const cookie = (name: string, value: string) => `${name}=${encodeURIComponent(value)}`;
