import { after, before, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { browser, cookieFrom } from './agent.js';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { createNotification } from '../services/notifications.js';
import cloudinary from '../config/cloudinary.js';

const adminLogin = { email: 'settings-admin@example.com', password: 'Admin-settings-password' };
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), admin: adminLogin, authLimit: 1000, secureCookies: false, sameSite: 'lax' });
const alice = browser(app), bob = browser(app), admin = browser(app);
const header = { 'X-GreenFarm-Request': 'true' };
const password = 'Customer-settings-password';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5qUAAAAASUVORK5CYII=', 'base64');
let database: MongoMemoryReplSet, aliceId: string, bobId: string;
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('customer_settings_test'));
  aliceId = (await alice.post('/api/auth/register').set(header).send({ fullName: 'Alice Settings', email: 'alice-settings@example.com', password }).expect(201)).body.user._id;
  bobId = (await bob.post('/api/auth/register').set(header).send({ fullName: 'Bob Settings', email: 'bob-settings@example.com', password }).expect(201)).body.user._id;
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

function mockUpload(context: TestContext, url = 'https://res.cloudinary.com/test/image/upload/avatar.png') {
  context.mock.method(cloudinary, 'config', () => ({ cloud_name: 'test' }));
  return context.mock.method(cloudinary.uploader, 'upload_stream', (...args: unknown[]) => {
    const done = args.at(-1) as (error: null, result: { secure_url: string }) => void;
    return new Writable({ write(_chunk, _encoding, callback) { callback(); }, final(callback) { done(null, { secure_url: url }); callback(); } });
  });
}
test('settings are restored from the cookie with safe defaults, and profile edits cannot target another account', async () => {
  const me = (await alice.get('/api/auth/me').expect(200)).body.user;
  assert.deepEqual(me.preferences, { productSort: 'newest', notifications: { order: true, account: true, promotion: true, system: true } });
  assert.equal(me.password, undefined);
  await alice.patch('/api/auth/profile').set(header).send({ _id: bobId, userId: bobId, email: 'forged@example.com', role: 'admin', fullName: 'Alice Updated', phone: '0241234567' }).expect(200);
  assert.equal((await User.findById(bobId))!.fullName, 'Bob Settings');
  const updated = (await alice.get('/api/auth/me')).body.user;
  assert.equal(updated.fullName, 'Alice Updated'); assert.equal(updated.email, me.email);
  await alice.patch('/api/auth/profile').set(header).send({ fullName: '' }).expect(400);
  await alice.patch('/api/auth/profile').set(header).send({ phone: 'invalid' }).expect(400);
  await alice.patch('/api/auth/profile').set(header).set('X-Profile-Owner', bobId).send({ fullName: 'Stale' }).expect(409);
});
test('all settings mutations need a customer cookie and CSRF; customer IDs in URL do not select owners', async () => {
  for (const agent of [request(app), admin]) {
    await agent.patch('/api/auth/preferences').set(header).send({ productSort: 'rating' }).expect(401);
    await agent.delete('/api/auth/profile/avatar').set(header).expect(401);
    await agent.patch('/api/auth/profile/avatar').set(header).attach('image', png, 'photo.png').expect(401);
  }
  await alice.patch('/api/auth/preferences').send({ productSort: 'rating' }).expect(403);
  await alice.patch(`/api/auth/profile/${bobId}/avatar`).set(header).attach('image', png, 'photo.png').expect(404);
});
test('avatar upload uses existing Cloudinary and updates only the cookie owner; refresh and relogin persist it', async (context) => {
  const upload = mockUpload(context);
  const response = await alice.patch(`/api/auth/profile/avatar?userId=${bobId}`).set(header).field('userId', bobId).attach('image', png, 'photo.png').expect(200);
  assert.equal(response.body.user._id, aliceId);
  assert.equal(response.body.user.avatar, 'https://res.cloudinary.com/test/image/upload/avatar.png');
  assert.equal((await User.findById(bobId))!.avatar, '');
  assert.equal((upload.mock.calls[0]!.arguments[0] as { folder: string }).folder, 'greenfarm/avatars');
  assert.equal((await alice.get('/api/auth/me')).body.user.avatar, response.body.user.avatar);
  await alice.post('/api/auth/logout').set(header).expect(200);
  const login = await alice.post('/api/auth/login').set(header).send({ email: 'alice-settings@example.com', password }).expect(200);
  assert.equal(login.body.user.avatar, response.body.user.avatar);
  assert.ok(cookieFrom(login, 'customerToken'));
  assert.ok((login.headers['set-cookie'] as unknown as string[]).some((value) => /HttpOnly/i.test(value)));
});
test('avatar removal is per-account and falls back to initials without changing profile details', async () => {
  const removed = await alice.delete(`/api/auth/profile/avatar?userId=${bobId}`).set(header).expect(200);
  assert.equal(removed.body.user.avatar, ''); assert.equal(removed.body.user.fullName, 'Alice Updated');
  assert.equal((await alice.get('/api/auth/me')).body.user.avatar, '');
});
test('invalid image types, spoofed content, missing images, oversized and duplicate files are rejected before Cloudinary', async (context) => {
  const upload = mockUpload(context);
  await alice.patch('/api/auth/profile/avatar').set(header).attach('image', Buffer.from('<svg/>'), { filename: 'photo.svg', contentType: 'image/svg+xml' }).expect(400);
  await alice.patch('/api/auth/profile/avatar').set(header).attach('image', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
  await alice.patch('/api/auth/profile/avatar').set(header).send({ avatar: 'https://example.com/a.png' }).expect(400);
  const large = Buffer.alloc(5 * 1024 * 1024 + 1); png.copy(large);
  const oversize = await alice.patch('/api/auth/profile/avatar').set(header).attach('image', large, 'big.png').expect(413);
  assert.match(oversize.body.message, /5 MB/);
  await alice.patch('/api/auth/profile/avatar').set(header).attach('image', png, 'a.png').attach('image', png, 'b.png').expect(400);
  await alice.patch('/api/auth/profile/avatar').set(header).set('X-Profile-Owner', bobId).attach('image', png, 'a.png').expect(409);
  assert.equal(upload.mock.callCount(), 0);
});
test('Cloudinary errors do not overwrite the saved avatar and a missing setup has a clear error', async (context) => {
  context.mock.method(cloudinary, 'config', () => ({}));
  await alice.patch('/api/auth/profile/avatar').set(header).attach('image', png, 'photo.png').expect(503);
  context.mock.method(cloudinary, 'config', () => ({ cloud_name: 'test' }));
  context.mock.method(cloudinary.uploader, 'upload_stream', () => { throw new Error('Upstream failure'); });
  await alice.patch('/api/auth/profile/avatar').set(header).attach('image', png, 'photo.png').expect(502);
  assert.equal((await User.findById(aliceId))!.avatar, '');
});
test('preferences validate supported values, use whitelisted fields and survive a new session', async () => {
  await alice.patch('/api/auth/preferences').set(header).send({ productSort: 'unknown' }).expect(400);
  await alice.patch('/api/auth/preferences').set(header).send({ notifications: { promotion: 'false' } }).expect(400);
  await alice.patch('/api/auth/preferences').set(header).send({ notifications: { security: false } }).expect(400);
  await alice.patch('/api/auth/preferences').set(header).send({}).expect(400);
  const result = await alice.patch(`/api/auth/preferences?userId=${bobId}`).set(header).send({ userId: bobId, role: 'admin', productSort: 'price_asc', notifications: { promotion: false } }).expect(200);
  assert.equal(result.body.user.preferences.productSort, 'price_asc');
  assert.equal(result.body.user.preferences.notifications.promotion, false);
  assert.equal(result.body.user.preferences.notifications.order, true);
  assert.equal((await User.findById(bobId))!.preferences.productSort, 'newest');
  await alice.post('/api/auth/logout').set(header).expect(200);
  const login = await alice.post('/api/auth/login').set(header).send({ email: 'alice-settings@example.com', password }).expect(200);
  assert.equal(login.body.user.preferences.productSort, 'price_asc');
});
test('notification switches change list, count and authorized mutations for one customer; re-enabling restores retained history', async () => {
  await Notification.deleteMany({});
  const notices = await Promise.all(['order', 'payment', 'account', 'promotion', 'system', 'security'].map((type) => createNotification({ audience: 'customers', title: type, message: 'Preference test', type })));
  await alice.patch('/api/auth/preferences').set(header).send({ notifications: { order: false, account: false, promotion: false, system: false } }).expect(200);
  const feed = (await alice.get('/api/notifications').expect(200)).body;
  assert.deepEqual(feed.notifications.map((item: { type: string }) => item.type), ['security']);
  assert.equal(feed.unreadCount, 1);
  assert.equal((await alice.get('/api/notifications/unread-count')).body.unreadCount, 1);
  assert.equal((await bob.get('/api/notifications')).body.notifications.length, 6);
  await alice.patch(`/api/notifications/${notices[0]!._id}/read`).set(header).expect(404);
  await alice.patch('/api/auth/preferences').set(header).send({ notifications: { order: true, account: true, promotion: true, system: true } }).expect(200);
  assert.equal((await alice.get('/api/notifications')).body.notifications.length, 6);
  const read = await alice.patch(`/api/notifications/${notices[0]!._id}/read`).set(header).expect(200);
  assert.equal(read.body.unreadCount, 5);
});
