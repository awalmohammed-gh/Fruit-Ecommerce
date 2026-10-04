import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import User, { type UserDocument } from '../models/User.js';
import DeliveryPartner, { type DeliveryPartnerDocument } from '../models/DeliveryPartner.js';
import Session, { type AccountType } from '../models/Session.js';
import bcrypt from 'bcryptjs';
import AdminSettings, { type AdminSettingsData } from '../models/AdminSettings.js';
import { HttpError } from './errors.js';
import type { AppConfig } from '../types.js';

/**
 * Sign-in
 *
 * Each account type has its own JWT in its own HTTP-only cookie:
 *
 *   customer  customerToken
 *   admin     adminToken
 *   partner   deliveryPartnerToken
 *
 * Each guard below reads only its own cookie, and each type's tokens are signed with their own key and
 * audience, so a customer, admin and delivery partner token can never stand in for one another. The
 * browser sends the cookies itself; frontend JavaScript never sees a token.
 *
 * The token carries only the account ID, its type (the audience) and a random token ID. Every sign-in also
 * stores that token ID (hashed) in a Session record, which is what makes signing out, password changes and
 * suspensions take effect at once instead of when the token expires.
 */
export const COOKIE: Record<AccountType, string> = { customer: 'customerToken', admin: 'adminToken', partner: 'deliveryPartnerToken' };
// How long a sign-in lasts. The admin can do the most damage with a stolen session, so theirs is shortest.
const LIFETIME_SECONDS: Record<AccountType, number> = { customer: 7 * 86_400, admin: 12 * 3_600, partner: 7 * 86_400 };
// The admin is also signed out after 30 minutes without a request, e.g. a dashboard left open on a shared computer.
const ADMIN_IDLE_MS = 30 * 60_000;
const ISSUER = 'greenfarm-api';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

// JWT_CUSTOMER_SECRET / JWT_ADMIN_SECRET / JWT_PARTNER_SECRET when set; otherwise a separate key per account
// type derived from JWT_SECRET_KEY. Either way a token signed for one type fails verification for another.
function signingKey(config: AppConfig, account: AccountType) {
  return config.jwtSecrets[account] || createHmac('sha256', config.jwtSecret).update(`greenfarm-jwt:${account}`).digest('base64url');
}
const audience = (account: AccountType) => `greenfarm:${account}`;

// The same options set and clear each cookie; a browser only removes a cookie when they match.
// Path /api: the cookies go to the API only, never with page or image requests.
function cookieOptions(config: AppConfig): CookieOptions {
  return { httpOnly: true, secure: config.secureCookies, sameSite: config.sameSite, path: '/api', ...(config.cookieDomain && { domain: config.cookieDomain }) };
}
const clearCookie = (res: Response, config: AppConfig, account: AccountType) => res.clearCookie(COOKIE[account], cookieOptions(config));

/** Signs `account` in: a Session record plus a fresh JWT in that type's cookie. Nothing is added to the response body. */
export async function startSession(res: Response, config: AppConfig, account: AccountType, accountId: unknown, version: unknown) {
  const tokenId = randomBytes(32).toString('base64url');
  const lifetime = LIFETIME_SECONDS[account];
  await Session.create({
    tokenHash: hash(tokenId), accountType: account, accountId: String(accountId), version: String(version),
    expiresAt: new Date(Date.now() + lifetime * 1000),
  });
  const token = jwt.sign({}, signingKey(config, account), {
    algorithm: 'HS256', subject: String(accountId), audience: audience(account), issuer: ISSUER, jwtid: tokenId, expiresIn: lifetime,
  });
  res.cookie(COOKIE[account], token, { ...cookieOptions(config), maxAge: lifetime * 1000 });
}

// A 401 names the account type, so the browser clears only that sign-in and goes to the right sign-in page.
const signedOut = (account: AccountType, message: string) => new HttpError(401, message, { account });
const EXPIRED = 'Your session has expired. Please sign in again.';

interface Claims { sub: string; jti: string }
/** The token's claims when it is genuine, unexpired and issued for `account`; null otherwise. */
function verifyToken(config: AppConfig, account: AccountType, token: string, ignoreExpiration = false): Claims | null {
  try {
    const claims = jwt.verify(token, signingKey(config, account), { algorithms: ['HS256'], audience: audience(account), issuer: ISSUER, ignoreExpiration });
    return typeof claims === 'object' && typeof claims.sub === 'string' && typeof claims.jti === 'string' ? { sub: claims.sub, jti: claims.jti } : null;
  } catch {
    return null;
  }
}

/**
 * The live Session behind this request's cookie for `account`: null when there is no cookie, otherwise the
 * session, or a 401 (and the stale cookie cleared) when the token is invalid, expired or signed out.
 */
async function readSession(req: Request, res: Response, config: AppConfig, account: AccountType) {
  const token: unknown = req.cookies?.[COOKIE[account]];
  if (typeof token !== 'string' || !token) return null;
  const claims = token.length <= 2048 ? verifyToken(config, account, token) : null;
  const session = claims && await Session.findOne({ tokenHash: hash(claims.jti), accountType: account, accountId: claims.sub, expiresAt: { $gt: new Date() } });
  if (!session) {
    clearCookie(res, config, account);
    throw signedOut(account, EXPIRED);
  }
  return session;
}
// The account is gone, deactivated or had its password changed since this sign-in.
function stale(res: Response, config: AppConfig, account: AccountType): never {
  clearCookie(res, config, account);
  throw signedOut(account, EXPIRED);
}

/** Signs out the sign-in this request's cookie belongs to (and only that one), and clears the cookie. */
export async function endSession(req: Request, res: Response, config: AppConfig, account: AccountType) {
  const token: unknown = req.cookies?.[COOKIE[account]];
  // An expired token can still be signed out; its record may outlive it by a few seconds.
  const claims = typeof token === 'string' && token.length <= 2048 ? verifyToken(config, account, token, true) : null;
  if (claims) await Session.deleteOne({ tokenHash: hash(claims.jti), accountType: account });
  clearCookie(res, config, account);
}
/** Ends every sign-in an account has, e.g. after a password change or suspension. */
export const endAllSessions = (account: AccountType, accountId: unknown) => Session.deleteMany({ accountType: account, accountId: String(accountId) });

// ---------- Customers ----------
async function currentCustomer(req: Request, res: Response, config: AppConfig): Promise<UserDocument | null> {
  const session = await readSession(req, res, config, 'customer');
  if (!session) return null;
  const user = mongoose.isObjectIdOrHexString(session.accountId) ? await User.findById(session.accountId).select('+tokenVersion') : null;
  if (!user || !user.isActive || String(user.tokenVersion) !== session.version) stale(res, config, 'customer');
  return user;
}
// Customer routes: profile, addresses, orders, reviews. Reads only customerToken.
export function customerAuth(config: AppConfig): RequestHandler {
  return async (req, res, next) => {
    const user = await currentCustomer(req, res, config);
    if (!user) throw signedOut('customer', 'Please sign in to continue');
    req.user = user;
    next();
  };
}
/** For restoring a sign-in after a refresh: the customer, or null when nobody is signed in. */
export const restoreCustomer = currentCustomer;

// ---------- Admin ----------
// Environment credentials bootstrap the admin; MongoDB stores personal settings and password overrides.
const ADMIN_ID = 'admin';
const adminCreatedAt = new Date().toISOString();
// Changing ADMIN_EMAIL or ADMIN_PSD changes this value and ends existing admin sessions.
export function adminVersion(config: AppConfig, passwordHash = '') {
  return createHmac('sha256', config.jwtSecret).update(`${config.admin!.email}\n${config.admin!.password}${passwordHash ? `\n${passwordHash}` : ''}`).digest('base64url');
}
export const storedAdmin = (config: AppConfig) => AdminSettings.findOne({ email: config.admin!.email }).select('+passwordHash');
const ensureAdminSettings = async (config: AppConfig) => (await storedAdmin(config)) ?? AdminSettings.findOneAndUpdate(
  { email: config.admin!.email }, { $setOnInsert: { bootstrapVersion: adminVersion(config) } },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
).select("+passwordHash");
// Rotating the configured credentials is also the recovery path for a forgotten saved password.
const savedPassword = (config: AppConfig, account: AdminSettingsData | null) => account?.bootstrapVersion === adminVersion(config) ? account.passwordHash : '';
const sameText = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
export function isAdminEmail(config: AppConfig, email: string) {
  return !!config.admin && sameText(email, config.admin.email);
}
export async function isAdminLogin(config: AppConfig, email: string, password: string) {
  // Compare both values so a wrong email and a wrong password take the same time.
  const emailMatches = isAdminEmail(config, email);
  if (!config.admin) return false;
  const account = emailMatches ? await storedAdmin(config) : null;
  const passwordHash = savedPassword(config, account);
  const passwordMatches = passwordHash ? await bcrypt.compare(password, passwordHash) : sameText(password, config.admin.password);
  return emailMatches && passwordMatches && account?.isActive !== false;
}
export async function startAdminSession(res: Response, config: AppConfig) {
  const account = await ensureAdminSettings(config);
  return startSession(res, config, 'admin', ADMIN_ID, adminVersion(config, savedPassword(config, account)));
}
export type AdminProfile = ReturnType<typeof adminProfile>;
export function adminProfile(config: AppConfig, account?: AdminSettingsData | null) {
  return {
    _id: ADMIN_ID, fullName: account?.fullName ?? 'GreenFarm Admin', email: config.admin!.email,
    phone: account?.phone ?? '', avatar: account?.avatar ?? '', isActive: account?.isActive !== false,
    lastLoginAt: account?.lastLoginAt?.toISOString() ?? null,
    role: 'admin' as const, createdAt: account?.createdAt?.toISOString() ?? adminCreatedAt,
  };
}
async function currentAdmin(req: Request, res: Response, config: AppConfig) {
  const session = await readSession(req, res, config, 'admin');
  if (!session) return null;
  if (!config.admin || session.accountId !== ADMIN_ID) stale(res, config, 'admin');
  const account = await ensureAdminSettings(config);
  if (account?.isActive === false || session.version !== adminVersion(config, savedPassword(config, account))) stale(res, config, 'admin');
  const idleFor = Date.now() - (session.lastSeenAt?.getTime() ?? 0);
  if (idleFor > ADMIN_IDLE_MS) {
    await session.deleteOne();
    stale(res, config, 'admin');
  }
  // Recorded at most once a minute, so ordinary use doesn't write on every request.
  if (idleFor > 60_000) await Session.updateOne({ _id: session._id }, { lastSeenAt: new Date() });
  return adminProfile(config, account);
}
// Every admin endpoint. Reads only adminToken; a customer or delivery partner sign-in (or role "admin" on a
// user record) is never enough.
export function adminAuth(config: AppConfig): RequestHandler {
  return async (req, res, next) => {
    const admin = await currentAdmin(req, res, config);
    if (!admin) throw signedOut('admin', 'Please sign in to the admin dashboard');
    req.admin = admin;
    next();
  };
}
export const restoreAdmin = currentAdmin;

// ---------- Delivery partners ----------
/** Why an account can't use the dashboard right now, or null when it can. Checked at login and on every request. */
export function partnerBlock(partner: Pick<DeliveryPartnerDocument, 'applicationStatus' | 'accountActivated' | 'isActive'>) {
  if (partner.applicationStatus === 'Pending') return 'Your application is still under review';
  if (partner.applicationStatus === 'Rejected') return 'Your application was not approved';
  if (partner.applicationStatus === 'Suspended') return 'Your delivery partner account is suspended. Contact GreenFarm.';
  if (!partner.accountActivated) return 'Activate your account before signing in';
  if (!partner.isActive) return 'This delivery partner account is inactive. Contact GreenFarm.';
  return null;
}
async function currentPartner(req: Request, res: Response, config: AppConfig): Promise<DeliveryPartnerDocument | null> {
  const session = await readSession(req, res, config, 'partner');
  if (!session) return null;
  const partner = mongoose.isObjectIdOrHexString(session.accountId) ? await DeliveryPartner.findById(session.accountId).select('+tokenVersion') : null;
  if (!partner || String(partner.tokenVersion) !== session.version) stale(res, config, 'partner');
  // Re-checked on every request, so a suspension takes effect immediately.
  const blocked = partnerBlock(partner);
  if (blocked) throw new HttpError(403, blocked);
  return partner;
}
// The driver workspace. Reads only deliveryPartnerToken.
export function deliveryPartnerAuth(config: AppConfig): RequestHandler {
  return async (req, res, next) => {
    const partner = await currentPartner(req, res, config);
    if (!partner) throw signedOut('partner', 'Please sign in to the delivery partner dashboard');
    req.deliveryPartner = partner;
    next();
  };
}
export const restorePartner = currentPartner;
