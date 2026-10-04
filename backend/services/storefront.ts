import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { pageMeta, renderHead } from './seo.js';

// Optional: serve the built storefront (frontend/dist) from this server, set with STOREFRONT_DIST.
// Every page is sent with its real title, description, sharing tags and structured data already in the
// HTML, and with a real 404 status for pages that don't exist. Link previews (WhatsApp, Facebook,
// LinkedIn, X) and crawlers that don't run JavaScript see the right content this way.
const SEO_BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/;
// What storefront pages may load: the app's own files, Google Fonts, and product, banner and map images
// from any HTTPS host (admins paste image links). No inline scripts, plugins or framing by other sites.
// Structured data (<script type="application/ld+json">) is data, not script, so it isn't affected.
const PAGE_POLICY = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com", "img-src 'self' data: blob: https:", "connect-src 'self'",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

export function storefront(dist: string, siteUrl: string) {
  const indexFile = path.join(dist, 'index.html');
  if (!fs.existsSync(indexFile)) throw new Error('STOREFRONT_DIST must point at the built storefront (run npm run build in frontend)');
  const template = fs.readFileSync(indexFile, 'utf8');
  if (!SEO_BLOCK.test(template)) throw new Error('The storefront index.html is missing its <!--seo--> block');

  const router = Router();
  // The app marks every response no-store (right for API data); static files set their own caching instead.
  router.use((req, res, next) => {
    if (path.extname(req.path)) res.removeHeader('Cache-Control');
    next();
  });
  // Built files have content hashes in their names, so they can be cached for a long time.
  router.use('/assets', express.static(path.join(dist, 'assets'), { index: false, immutable: true, maxAge: '1y', fallthrough: false }));
  router.use(express.static(dist, { index: false, maxAge: '1h' }));
  router.use(async (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) return next();
    const meta = await pageMeta(req.path, req.query as Record<string, unknown>, siteUrl);
    res.status(meta.status)
      .set({ 'X-Robots-Tag': meta.robots, 'Cache-Control': 'no-cache', 'Content-Security-Policy': PAGE_POLICY })
      .type('html')
      .send(template.replace(SEO_BLOCK, `<!--seo-->\n    ${renderHead(meta)}\n    <!--/seo-->`));
  });
  return router;
}
