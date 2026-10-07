import type { Request, Response } from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { siteContent } from '../services/content.js';
import { pageMeta } from '../services/seo.js';
import { HttpError } from '../middleware/errors.js';
import { sharedCache } from '../middleware/cache.js';
import type { AppConfig } from '../types.js';

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const day = (date: Date | string | undefined) => (date ? new Date(date).toISOString().slice(0, 10) : undefined);

export function seoController(config: AppConfig) {
  const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${config.siteUrl}${url}`);
  return {
    // GET /api/seo?path=/products/cheese-200g%3Fpage%3D2 — the storefront calls this on every navigation.
    meta: async (req: Request, res: Response) => {
      const raw = typeof req.query.path === 'string' ? req.query.path : '';
      if (!raw.startsWith('/') || raw.startsWith('//') || raw.length > 600) throw new HttpError(400, 'path must be a page on this site, such as /products');
      const url = new URL(raw, 'http://storefront');
      const meta = await pageMeta(decodeURIComponent(url.pathname), Object.fromEntries(url.searchParams), config.siteUrl);
      sharedCache(res, 300);
      res.json(meta);
    },

    // Public, indexable pages only, built from the database on each request.
    sitemap: async (_req: Request, res: Response) => {
      const [content, categories, products] = await Promise.all([
        siteContent(),
        Category.find({ isActive: { $ne: false } }).select('slug updatedAt image seoImage').sort({ name: 1 }).lean(),
        Product.find({ slug: { $type: 'string' } }).select('slug updatedAt image name').sort({ createdAt: -1 }).lean(),
      ]);
      const entry = (path: string, lastmod?: string, image?: string) => [
        '  <url>',
        `    <loc>${escapeXml(absolute(path))}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        ...(image ? [`    <image:image><image:loc>${escapeXml(absolute(image))}</image:loc></image:image>`] : []),
        '  </url>',
      ].join('\n');
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        entry('/', day(content.updatedAt)),
        entry('/products', day(products[0]?.updatedAt)),
        entry('/deals'),
        entry('/delivery-partner/apply'),
        ...categories.map((category) => entry(`/category/${category.slug}`, day(category.updatedAt), category.seoImage || category.image || undefined)),
        ...products.map((product) => entry(`/products/${product.slug}`, day(product.updatedAt), product.image)),
        '</urlset>',
      ].join('\n');
      res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(xml);
    },

    // Keeps crawlers out of private areas. These areas are still protected by sign-in; this only avoids wasted crawling.
    robots: (_req: Request, res: Response) => {
      res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send([
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /account',
        'Disallow: /checkout',
        'Disallow: /cart',
        'Disallow: /login',
        'Disallow: /my-orders',
        'Disallow: /my-address',
        'Disallow: /delivery-partner/',
        'Allow: /delivery-partner/apply',
        'Disallow: /delivery/',
        'Disallow: /search',
        'Disallow: /api/',
        '',
        `Sitemap: ${config.siteUrl}/sitemap.xml`,
        '',
      ].join('\n'));
    },
  };
}
