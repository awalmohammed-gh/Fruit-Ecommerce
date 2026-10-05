import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import Session from '../models/Session.js';
import RateLimit from '../models/RateLimit.js';
import { browser, cookie, cookieFrom } from './agent.js';
import { becomePartner, header } from './partners.js';

const adminLogin = { email: 'boss@greenfarm.test', password: 'Static-admin-pass' };
// A known customer signing secret, so the tests can forge and expire tokens.
const customerSecret = randomBytes(48).toString('hex');
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), jwtSecrets: { customer: customerSecret }, authLimit: 1000, secureCookies: false, sameSite: 'lax', admin: adminLogin });
const password = 'Test-password-123';
let database: MongoMemoryReplSet;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_sessions_test'));
  for (const [fullName, email] of [['Ama Owusu', 'ama@example.com'], ['Kofi Mensah', 'kofi@example.com'], ['Esi Locked', 'esi@example.com']]) {
    await request(app).post('/api/auth/register').set(header).send({ fullName, email, password }).expect(201);
  }
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

const signIn = (email = 'ama@example.com') => request(app).post('/api/auth/login').set(header).send({ email, password }).expect(200);
const attributes = (response: request.Response, name: string) => ((response.headers['set-cookie'] ?? []) as unknown as string[]).find((line) => line.startsWith(`${name}=`)) ?? '';

test('sign-in puts a short JWT in an HTTP-only customerToken cookie and never in the response body', async () => {
  const response = await signIn();
  const line = attributes(response, 'customerToken');
  assert.match(line, /HttpOnly/);
  assert.match(line, /SameSite=Lax/);
  assert.match(line, /Path=\/api/);
  assert.match(line, /Max-Age=604800/);
  assert.doesNotMatch(line, /Secure/, 'plain HTTP on localhost in development');
  assert.equal(response.body.user.email, 'ama@example.com');
  assert.equal(JSON.stringify(response.body).includes(cookieFrom(response, 'customerToken')!), false);
  assert.equal(response.body.session, undefined);

  // Only the account ID, its type and a token ID: no email, name, role or password.
  const claims = jwt.decode(cookieFrom(response, 'customerToken')!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(claims).sort(), ['aud', 'exp', 'iat', 'iss', 'jti', 'sub']);
  assert.equal(claims.sub, response.body.user._id);
  assert.equal(claims.aud, 'greenfarm:customer');
  // Only a hash of the token ID is stored server-side.
  const stored = await Session.findOne({ accountId: response.body.user._id }).sort({ createdAt: -1 });
  assert.equal(stored!.accountType, 'customer');
  assert.notEqual(stored!.tokenHash, claims.jti);
});

test('production cookies are Secure; SameSite=None is only allowed with them', async () => {
  const secure = createApp({ jwtSecret: randomBytes(48).toString('hex'), secureCookies: true, sameSite: 'none', authLimit: 1000, admin: adminLogin, cookieDomain: 'greenfarm.test' });
  const response = await request(secure).post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  const line = attributes(response, 'adminToken');
  assert.match(line, /Secure/);
  assert.match(line, /SameSite=None/);
  assert.match(line, /Domain=greenfarm.test/);
  assert.match(line, /Max-Age=43200/, 'admin sign-ins last 12 hours');
  assert.match(response.headers['strict-transport-security'] ?? '', /max-age=/);
  assert.throws(() => createApp({ jwtSecret: randomBytes(48).toString('hex'), secureCookies: false, sameSite: 'none' }), /HTTPS/);
  assert.throws(() => createApp({ jwtSecret: randomBytes(48).toString('hex'), origins: ['*'] }), /exact origins/);
});

test('one browser holds a customer, the admin and a partner side by side, and each signs out alone', async () => {
  const admin = browser(app);
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  const visitor = browser(app);
  await becomePartner(admin, visitor, 'rider.one@example.com', 'Rider One');
  await visitor.post('/api/auth/login').set(header).send({ email: 'ama@example.com', password }).expect(200);
  await visitor.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);

  // A refresh: each current-session endpoint reads only its own cookie.
  assert.equal((await visitor.get('/api/auth/me').expect(200)).body.user.email, 'ama@example.com');
  assert.equal((await visitor.get('/api/auth/admin/me').expect(200)).body.admin.email, adminLogin.email);
  assert.equal((await visitor.get('/api/delivery/me').expect(200)).body.partner.email, 'rider.one@example.com');

  const out = await visitor.post('/api/auth/logout').set(header).expect(200);
  const cleared = ((out.headers['set-cookie'] ?? []) as unknown as string[]);
  assert.equal(cleared.length, 1, 'only customerToken is cleared');
  assert.match(cleared[0]!, /^customerToken=;.*Path=\/api.*HttpOnly/);
  assert.equal((await visitor.get('/api/auth/me').expect(200)).body.user, null);
  await visitor.get('/api/admin/orders').expect(200);
  await visitor.get('/api/delivery/summary').expect(200);

  await visitor.post('/api/auth/admin/logout').set(header).expect(200);
  await visitor.get('/api/admin/orders').expect(401);
  await visitor.get('/api/delivery/summary').expect(200);
  await visitor.post('/api/delivery/logout').set(header).expect(200);
  await visitor.get('/api/delivery/summary').expect(401);
});

test('a token only works in its own cookie, and forged, expired, replayed and missing tokens are refused', async () => {
  const customer = cookieFrom(await signIn(), 'customerToken')!;
  const admin = cookieFrom(await request(app).post('/api/auth/admin/login').set(header).send(adminLogin).expect(200), 'adminToken')!;
  const asCustomer = (token: string) => request(app).get('/api/addresses').set('Cookie', cookie('customerToken', token));

  await asCustomer(customer).expect(200);
  // Right token, wrong cookie: never accepted by another account type.
  await request(app).get('/api/admin/orders').set('Cookie', cookie('adminToken', customer)).expect(401);
  await request(app).get('/api/delivery/summary').set('Cookie', cookie('deliveryPartnerToken', customer)).expect(401);
  await asCustomer(admin).expect(401);
  // A customer cookie on an admin endpoint is simply not an admin sign-in.
  const refused = await request(app).get('/api/admin/orders').set('Cookie', cookie('customerToken', customer)).expect(401);
  assert.equal(refused.body.account, 'admin');

  // Missing and garbage tokens.
  await request(app).get('/api/addresses').expect(401);
  assert.equal((await request(app).get('/api/auth/me').expect(200)).body.user, null);
  const garbage = await asCustomer('not-a-jwt').expect(401);
  assert.equal(garbage.body.account, 'customer');
  assert.match(attributes(garbage, 'customerToken'), /^customerToken=;/, 'the stale cookie is cleared');

  // Tampered: changed payload, wrong key, unsigned.
  const claims = jwt.decode(customer) as { sub: string; jti: string };
  const [head, , signature] = customer.split('.');
  const otherBody = Buffer.from(JSON.stringify({ ...claims, sub: new mongoose.Types.ObjectId().toString() })).toString('base64url');
  await asCustomer(`${head}.${otherBody}.${signature}`).expect(401);
  await asCustomer(jwt.sign({}, 'x'.repeat(48), { subject: claims.sub, jwtid: claims.jti, audience: 'greenfarm:customer', issuer: 'greenfarm-api' })).expect(401);
  await asCustomer(jwt.sign({}, '', { algorithm: 'none', subject: claims.sub, jwtid: claims.jti, audience: 'greenfarm:customer', issuer: 'greenfarm-api' })).expect(401);

  // Expired JWT (the session record is still there) and an expired session record (the JWT is still valid).
  const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, customerSecret, { subject: claims.sub, jwtid: claims.jti, audience: 'greenfarm:customer', issuer: 'greenfarm-api' });
  const expiredResponse = await asCustomer(expired).expect(401);
  assert.equal(expiredResponse.body.message, 'Your session has expired. Please sign in again.');
  await Session.updateMany({ accountType: 'customer', accountId: claims.sub }, { expiresAt: new Date(Date.now() - 1000) });
  await asCustomer(customer).expect(401);

  // Replaying a token after sign-out.
  const fresh = browser(app);
  const token = cookieFrom(await fresh.post('/api/auth/login').set(header).send({ email: 'kofi@example.com', password }).expect(200), 'customerToken')!;
  await fresh.post('/api/auth/logout').set(header).expect(200);
  await asCustomer(token).expect(401);
});

test('a password change signs out every other browser; deactivation and suspension end sign-ins at once', async () => {
  const laptop = browser(app);
  const phone = browser(app);
  await laptop.post('/api/auth/login').set(header).send({ email: 'kofi@example.com', password }).expect(200);
  await phone.post('/api/auth/login').set(header).send({ email: 'kofi@example.com', password }).expect(200);
  await phone.patch('/api/auth/password').set(header).send({ currentPassword: password, newPassword: 'Changed-pass-456' }).expect(200);
  await phone.get('/api/addresses').expect(200);
  await laptop.get('/api/addresses').expect(401);
  await phone.patch('/api/auth/password').set(header).send({ currentPassword: 'Changed-pass-456', newPassword: password }).expect(200);

  const admin = browser(app);
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  const rider = browser(app);
  const riderId = await becomePartner(admin, rider, 'rider.two@example.com', 'Rider Two');
  await rider.get('/api/delivery/summary').expect(200);
  await rider.get('/api/admin/orders').expect(401);
  await admin.patch(`/api/admin/delivery/applications/${riderId}/status`).set(header).send({ status: 'Suspended' }).expect(200);
  assert.equal(await Session.countDocuments({ accountType: 'partner', accountId: riderId }), 0);
  const ended = await rider.get('/api/delivery/summary').expect(401);
  assert.equal(ended.body.account, 'partner');
});

test('an admin sign-in ends after 30 minutes without activity', async () => {
  const office = browser(app);
  await office.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  await office.get('/api/admin/orders').expect(200);
  await Session.updateMany({ accountType: 'admin' }, { lastSeenAt: new Date(Date.now() - 20 * 60_000) });
  await office.get('/api/admin/orders').expect(200);
  assert.ok((await Session.findOne({ accountType: 'admin' }).sort({ createdAt: -1 }))!.lastSeenAt!.getTime() > Date.now() - 60_000, 'activity is recorded');
  await Session.updateMany({ accountType: 'admin' }, { lastSeenAt: new Date(Date.now() - 31 * 60_000) });
  const idle = await office.get('/api/admin/orders').expect(401);
  assert.equal(idle.body.account, 'admin');
  assert.equal((await office.get('/api/auth/admin/me').expect(200)).body.admin, null, 'the cookie was cleared');
});

test('repeated wrong passwords lock that account only, from any address', async () => {
  for (let attempt = 0; attempt < 5; attempt++) await request(app).post('/api/auth/login').set(header).send({ email: 'esi@example.com', password: 'Wrong-guess-1' }).expect(401);
  const locked = await request(app).post('/api/auth/login').set(header).send({ email: 'esi@example.com', password }).expect(429);
  assert.match(locked.body.message, /Too many failed sign-in attempts/);
  assert.ok(Number(locked.headers['retry-after']) > 0);
  await signIn('ama@example.com');
  for (let attempt = 0; attempt < 5; attempt++) await request(app).post('/api/auth/admin/login').set(header).send({ ...adminLogin, password: 'Wrong-admin-guess' }).expect(401);
  await request(app).post('/api/auth/admin/login').set(header).send(adminLogin).expect(429);
});

test('each sign-in endpoint has its own per-address limit, kept in the database', async () => {
  // Counters live in MongoDB and are shared by every app instance, so start this one from zero.
  await RateLimit.deleteMany({});
  const limited = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 2, admin: adminLogin });
  for (let attempt = 0; attempt < 2; attempt++) await request(limited).post('/api/auth/login').set(header).send({ email: 'nobody@example.com', password }).expect(401);
  const blocked = await request(limited).post('/api/auth/login').set(header).send({ email: 'nobody@example.com', password }).expect(429);
  assert.ok(blocked.headers['retry-after']);
  // Failed logins don't use up the sign-up or admin budgets.
  await request(limited).post('/api/auth/register').set(header).send({ fullName: 'New Person', email: 'new.person@example.com', password }).expect(201);
  await request(limited).post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  // A spoofed X-Forwarded-For doesn't reset the count unless TRUST_PROXY says a proxy is there.
  await request(limited).post('/api/auth/login').set(header).set('X-Forwarded-For', '203.0.113.9').send({ email: 'nobody@example.com', password }).expect(429);
  // A restart (a new app instance) doesn't reset the count.
  const restarted = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 2, admin: adminLogin });
  await request(restarted).post('/api/auth/login').set(header).send({ email: 'nobody@example.com', password }).expect(429);
  assert.ok(await RateLimit.exists({ key: /^ip:login:/ }));
  assert.throws(() => { process.env.TRUST_PROXY = 'true'; try { createApp({ jwtSecret: randomBytes(48).toString('hex') }); } finally { delete process.env.TRUST_PROXY; } }, /number of proxies/);
});

test('cookie-authenticated changes need the request header and an allowed origin (CSRF)', async () => {
  const shopper = browser(app);
  await shopper.post('/api/auth/login').set(header).send({ email: 'ama@example.com', password }).expect(200);
  const address = { label: 'Home', fullName: 'Ama', phone: '0245556677', addressLine1: '3 Palm Lane', city: 'Tema', region: 'Greater Accra' };
  // A forged form post carries the cookie but can't add the header.
  await shopper.post('/api/addresses').send(address).expect(403);
  await shopper.post('/api/addresses').set(header).set('Origin', 'https://evil.example').send(address).expect(403);
  const preflight = await shopper.options('/api/addresses').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
  assert.equal(preflight.headers['access-control-allow-origin'], undefined);
  const allowed = await request(app).options('/api/addresses').set('Origin', 'http://localhost:5174').set('Access-Control-Request-Method', 'POST');
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5174');
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
  await shopper.post('/api/addresses').set(header).set('Origin', 'http://localhost:5174').send(address).expect(201);
  // The address the API is served on is allowed without being listed; any other site still isn't.
  await shopper.post('/api/addresses').set(header).set('Host', 'greenfarm-abc123.vercel.app').set('Origin', 'https://greenfarm-abc123.vercel.app').send({ ...address, label: 'Work' }).expect(201);
  await shopper.post('/api/addresses').set(header).set('Host', 'greenfarm-abc123.vercel.app').set('Origin', 'https://evil.example').send(address).expect(403);
});

test('responses carry security headers', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.match(response.headers['content-security-policy'] ?? '', /frame-ancestors 'none'/);
  assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(response.headers['strict-transport-security'], undefined, 'HSTS only on HTTPS deployments');
});
