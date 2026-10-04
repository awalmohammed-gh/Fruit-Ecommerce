import type { RequestHandler } from 'express';
import type { AppConfig } from '../types.js';

// API responses are data: nothing in them may run, load anything or be shown in a frame.
// Storefront pages (services/storefront.ts) replace this with a policy for the app.
const API_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function securityHeaders(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-site',
      'Content-Security-Policy': API_POLICY,
      'Cache-Control': 'no-store',
    });
    // Production runs on HTTPS (secure cookies require it), so browsers may insist on it from then on.
    if (config.secureCookies) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // API responses are data, never pages to show in search results.
    if (req.path.startsWith('/api/')) res.set('X-Robots-Tag', 'noindex');
    next();
  };
}
