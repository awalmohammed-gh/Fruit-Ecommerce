import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { HttpError, errorHandler } from './middleware/errors.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { authRoutes } from './routes/authRoutes.js';
import { addressRoutes } from './routes/addressRoutes.js';
import { productRoutes } from './routes/productRoutes.js';
import { categoryRoutes } from './routes/categoryRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { orderRoutes } from './routes/orderRoutes.js';
import { deliveryRoutes } from './routes/deliveryRoutes.js';
import { contentRoutes } from './routes/contentRoutes.js';
import { seoController } from './controllers/seoController.js';
import { storefront } from './services/storefront.js';
import type { AccountType } from './models/Session.js';
import type { AppConfig } from './types.js';

// Optional separate signing secret per account type; without one, a per-type key is derived from JWT_SECRET_KEY.
function jwtSecrets() {
  const secrets: AppConfig['jwtSecrets'] = {};
  for (const [account, name] of [['customer', 'JWT_CUSTOMER_SECRET'], ['admin', 'JWT_ADMIN_SECRET'], ['partner', 'JWT_PARTNER_SECRET']] as [AccountType, string][]) {
    const value = process.env[name]?.trim();
    if (!value) continue;
    if (value.length < 32) throw new Error(`${name} must contain at least 32 characters`);
    secrets[account] = value;
  }
  return secrets;
}
// How many proxies sit in front of the API (e.g. 1 behind Render, Railway or Nginx), so req.ip is the visitor.
function trustProxy(value = '') {
  const setting = value.trim();
  if (!setting || setting === 'false') return false;
  if (setting === 'true') throw new Error('TRUST_PROXY=true would trust any X-Forwarded-For header. Set the number of proxies in front of the API, e.g. 1');
  return /^\d+$/.test(setting) ? Number(setting) : setting;
}

// A browser sets Origin itself, so another site can't claim to be this one.
function sameHost(origin: string, host: string | undefined) {
  try { return !!host && new URL(origin).host === host; } catch { return false; }
}

export function createApp(overrides: Partial<AppConfig> = {}) {
  const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite)) throw new Error('Invalid COOKIE_SAME_SITE');
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(); const adminPassword = process.env.ADMIN_PSD || '';
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5174,http://localhost:5175').split(',').map((value) => value.trim().replace(/\/+$/, '')).filter(Boolean);
  const config: AppConfig = { jwtSecret: process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || '', jwtSecrets: jwtSecrets(),
    origins,
    // The storefront's public address; without PUBLIC_SITE_URL, the first allowed origin (after any overrides).
    siteUrl: (process.env.PUBLIC_SITE_URL?.trim() || (overrides.origins ?? origins)[0]!).replace(/\/+$/, ''),
    storefrontDist: process.env.STOREFRONT_DIST?.trim() || null,
    secureCookies: process.env.NODE_ENV === 'production', sameSite: sameSite as AppConfig['sameSite'],
    cookieDomain: process.env.COOKIE_DOMAIN?.trim() || null, trustProxy: trustProxy(process.env.TRUST_PROXY),
    authLimit: 20, loginLockout: 5,
    admin: adminEmail || adminPassword ? { email: adminEmail, password: adminPassword } : null, ...overrides };
  if (config.jwtSecret.length < 32) throw new Error('JWT_SECRET_KEY must contain at least 32 characters');
  if (config.sameSite === 'none' && !config.secureCookies) throw new Error('COOKIE_SAME_SITE=none requires HTTPS cookies (NODE_ENV=production)');
  // Cookies are only sent to origins named exactly; a wildcard would hand them to any site.
  if (config.origins.some((origin) => origin === '*' || origin.includes('*'))) throw new Error('CLIENT_ORIGIN must list exact origins, e.g. https://greenfarm.com');
  if (config.admin && (!config.admin.email.includes('@') || config.admin.password.length < 8)) throw new Error('ADMIN_EMAIL must be an email and ADMIN_PSD at least 8 characters');

  const app = express(); app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders(config));
  // Only the storefront's own origins may call the API with the sign-in cookies: those in CLIENT_ORIGIN, and the
  // address the API itself is served on (on Vercel the storefront shares it, including per-deployment URLs).
  app.use(cors((req, callback) => {
    const origin = req.headers.origin;
    const allowed = !origin || config.origins.includes(origin) || sameHost(origin, req.headers.host);
    callback(allowed ? null : new HttpError(403, 'Origin is not allowed'), {
      origin: true,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-GreenFarm-Request', 'Idempotency-Key'],
      maxAge: 600,
    });
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '32kb' }));
  // CSRF: the sign-in cookies are SameSite, and every change must also carry this header. Another site can't
  // add a custom header without a CORS preflight, which the origin check above refuses, so a forged form or
  // cross-site request never reaches a handler with the visitor's cookies. GET requests never change anything.
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-GreenFarm-Request') !== 'true') throw new HttpError(403, 'Missing request verification header');
    next();
  });
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/api/auth', authRoutes(config)); app.use('/api/addresses', addressRoutes(config));
  app.use('/api/products', productRoutes(config));
  app.use('/api/categories', categoryRoutes(config));
  app.use('/api/admin', adminRoutes(config));
  app.use('/api/orders', orderRoutes(config));
  app.use('/api/delivery', deliveryRoutes(config));
  app.use('/api/content', contentRoutes());
  // SEO: page metadata for the storefront, plus the sitemap and robots.txt at the site root.
  const seo = seoController(config);
  app.get('/api/seo', seo.meta);
  app.get('/sitemap.xml', seo.sitemap);
  app.get('/robots.txt', seo.robots);
  if (config.storefrontDist) app.use(storefront(config.storefrontDist, config.siteUrl));
  app.use((_req, res) => { res.status(404).json({ message: 'Route not found' }); }); app.use(errorHandler);
  return app;
}
