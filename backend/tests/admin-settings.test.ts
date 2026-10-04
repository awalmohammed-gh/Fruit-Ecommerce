import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import AdminSettings from '../models/AdminSettings.js';
import { browser } from './agent.js';

const credentials = { email: 'settings@greenfarm.test', password: 'Initial-password-123' };
const config = { jwtSecret: randomBytes(48).toString('hex'), authLimit: 1000, secureCookies: false, sameSite: 'lax' as const, admin: credentials };
const app = createApp(config);
const admin = browser(app);
const otherSession = browser(app);
const header = { 'X-GreenFarm-Request': 'true' };
let database: MongoMemoryReplSet;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('admin_settings_test'));
  await admin.post('/api/auth/admin/login').set(header).send(credentials).expect(200);
  await otherSession.post('/api/auth/admin/login').set(header).send(credentials).expect(200);
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('personal settings require an admin session and reject ownership and privilege fields', async () => {
  await browser(app).get('/api/admin/preferences').expect(401);
  for (const field of ['email', 'role', 'permissions', 'isActive', '_id']) {
    await admin.patch('/api/admin/account/profile').set(header).send({ [field]: 'changed' }).expect(400);
  }
  await admin.patch('/api/admin/preferences').set(header).send({ adminId: 'someone-else' }).expect(400);
});

test('profile and preferences persist across logout and application restart without exposing secrets', async () => {
  const result = await admin.patch('/api/admin/account/profile').set(header).send({ fullName: 'Ama Mensah', phone: '0241234567', avatar: 'https://example.com/avatar.webp' }).expect(200);
  assert.equal(result.body.admin.fullName, 'Ama Mensah');
  assert.equal(result.body.admin.email, credentials.email);
  assert.equal(result.body.admin.role, 'admin');
  assert.ok(result.body.admin.lastLoginAt);
  assert.equal(result.body.admin.passwordHash, undefined);
  const preferences = { appearance: 'light', sidebar: 'collapsed', tableDensity: 'compact', pageSize: 100, dateFormat: 'YYYY-MM-DD', timeFormat: '12-hour', currencyDisplay: 'code' };
  await admin.patch('/api/admin/preferences').set(header).send(preferences).expect(200);
  for (const invalid of [{ pageSize: 101 }, { appearance: 'unsupported' }, { dateFormat: 'invalid' }]) {
    await admin.patch('/api/admin/preferences').set(header).send(invalid).expect(400);
  }
  await admin.post('/api/auth/admin/logout').set(header).expect(200);
  const restored = browser(createApp(config));
  const login = await restored.post('/api/auth/admin/login').set(header).send(credentials).expect(200);
  assert.equal(login.body.admin.fullName, 'Ama Mensah');
  assert.deepEqual((await restored.get('/api/admin/preferences').expect(200)).body.preferences, preferences);
  await admin.post('/api/auth/admin/login').set(header).send(credentials).expect(200);
  const separate = browser(createApp({ ...config, admin: { email: 'another@greenfarm.test', password: 'Another-password-123' } }));
  await separate.post('/api/auth/admin/login').set(header).send({ email: 'another@greenfarm.test', password: 'Another-password-123' }).expect(200);
  assert.equal((await separate.get('/api/admin/preferences').expect(200)).body.preferences.sidebar, 'expanded');
});

test('supported themes persist across application restarts', async () => {
  for (const appearance of ['dark', 'system', 'light']) {
    const result = await admin.patch('/api/admin/preferences').set(header).send({ appearance }).expect(200);
    assert.equal(result.body.preferences.appearance, appearance);
    assert.equal(result.body.preferences.pageSize, 100);
    assert.equal((await AdminSettings.findOne({ email: credentials.email }))?.preferences.appearance, appearance);
    const restored = browser(createApp(config));
    await restored.post('/api/auth/admin/login').set(header).send(credentials).expect(200);
    assert.equal((await restored.get('/api/admin/preferences').expect(200)).body.preferences.appearance, appearance);
  }
});

test('password changes validate, hash securely, revoke other sessions and support credential recovery', async () => {
  const next = 'Replacement-password-456';
  await admin.patch('/api/admin/account/password').set(header).send({ currentPassword: 'wrong-password', newPassword: next, confirmPassword: next }).expect(400);
  await admin.patch('/api/admin/account/password').set(header).send({ currentPassword: credentials.password, newPassword: next, confirmPassword: 'mismatch' }).expect(400);
  const changed = await admin.patch('/api/admin/account/password').set(header).send({ currentPassword: credentials.password, newPassword: next, confirmPassword: next }).expect(200);
  assert.equal(changed.body.passwordHash, undefined);
  const record = await AdminSettings.findOne({ email: credentials.email }).select('+passwordHash');
  assert.ok(record && record.passwordHash !== next && await bcrypt.compare(next, record.passwordHash));
  await admin.get('/api/admin/preferences').expect(200);
  await otherSession.get('/api/admin/preferences').expect(401);
  const fresh = browser(app);
  await fresh.post('/api/auth/admin/login').set(header).send(credentials).expect(401);
  await fresh.post('/api/auth/admin/login').set(header).send({ ...credentials, password: next }).expect(200);
  const recovery = browser(createApp({ ...config, admin: { ...credentials, password: 'Recovery-password-789' } }));
  await recovery.post('/api/auth/admin/login').set(header).send({ ...credentials, password: 'Recovery-password-789' }).expect(200);
  assert.equal((await recovery.get('/api/auth/admin/me').expect(200)).body.admin.fullName, 'Ama Mensah');
});
