import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { browser, cookie, cookieFrom } from './agent.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import RateLimit from '../models/RateLimit.js';
import Address from '../models/Address.js';

const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 1000, secureCookies: false, sameSite: 'lax' });
const alice = browser(app);
const bob = browser(app);
const header = { 'X-GreenFarm-Request': 'true' };
const password = 'Test-password-123';
let database: MongoMemoryReplSet;
let aliceId: string;
let bobId: string;
let homeId: string;
let officeId: string;
const address = { label: 'Home', fullName: 'Alice Test', phone: '0241234567', addressLine1: '12 Test Street', city: 'Accra', region: 'Greater Accra', isDefault: false };

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_test'));
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('registration normalizes email, hashes passwords, starts a server-side session and ignores privilege fields', async () => {
  const response = await alice.post('/api/auth/register').set(header).send({ fullName: ' Alice Test ', email: ' ALICE@EXAMPLE.COM ', password, role: 'admin', isActive: false }).expect(201);
  aliceId = response.body.user._id;
  assert.equal(response.body.user.fullName, 'Alice Test');
  assert.equal(response.body.user.email, 'alice@example.com');
  assert.equal(response.body.user.role, 'user');
  assert.equal(response.body.user.isActive, true);
  assert.equal(response.body.user.password, undefined);
  // Signed straight in: the JWT goes in the HTTP-only customerToken cookie, never in the body.
  const token = cookieFrom(response, 'customerToken');
  assert.ok(token);
  assert.equal(response.body.session, undefined);
  assert.equal(JSON.stringify(response.body).includes(token!), false);
  const stored = await Session.findOne({ accountId: String(aliceId) });
  assert.equal(stored!.accountType, 'customer');
  const saved = await User.findById(aliceId).select('+password');
  assert.notEqual(saved!.password, password);
  assert.equal(await bcrypt.compare(password, saved!.password), true);
  await alice.get('/api/auth/me').expect(200);
  const second = await bob.post('/api/auth/register').set(header).send({ fullName: 'Bob Test', email: 'bob@example.com', password }).expect(201);
  bobId = second.body.user._id;
});

test('registration and login reject invalid fields, duplicates and invalid credentials', async () => {
  await request(app).post('/api/auth/register').set(header).send({ fullName: '', email: 'invalid', password: 'short' }).expect(400);
  await request(app).post('/api/auth/register').set(header).send({ fullName: 'Alice', email: 'ALICE@example.com', password }).expect(409);
  await request(app).post('/api/auth/login').set(header).send({ email: 'alice@example.com', password: 'wrong-password' }).expect(401);
  assert.equal((await request(app).get('/api/auth/me').expect(200)).body.user, null);
  await request(app).get('/api/addresses').expect(401);
  await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password }).expect(403);
  await request(app).post('/api/auth/login').set(header).set('Origin', 'https://untrusted.example').send({ email: 'alice@example.com', password }).expect(403);
  const invalid = await request(app).get('/api/auth/me').set('Cookie', cookie('customerToken', 'invalid')).expect(401);
  assert.equal(invalid.body.account, 'customer', 'tells the browser which sign-in to clear');
});

test('profile whitelist protects role, active state, ID, email and password', async () => {
  const response = await alice.patch('/api/auth/profile').set(header).send({ fullName: 'Alice Updated', phone: '+233241234567', avatar: 'https://example.com/avatar.png', role: 'admin', isActive: false, _id: bobId, email: 'hijack@example.com', password: 'hijacked-password' }).expect(200);
  assert.equal(response.body.user.fullName, 'Alice Updated');
  assert.equal(response.body.user._id, aliceId);
  assert.equal(response.body.user.email, 'alice@example.com');
  assert.equal(response.body.user.role, 'user');
  assert.equal(response.body.user.isActive, true);
  assert.equal(response.body.user.password, undefined);
  await alice.patch('/api/auth/profile').set(header).send({ avatar: 'javascript:alert(1)' }).expect(400);
  await alice.patch('/api/auth/profile').set(header).send({ phone: 'not-a-phone' }).expect(400);
  assert.equal((await bob.get('/api/auth/me').expect(200)).body.user.fullName, 'Bob Test');
});

test('first address becomes default; multiple addresses persist; supplied owners are ignored', async () => {
  const first = await alice.post('/api/addresses').set(header).send({ ...address, user: bobId, userId: bobId }).expect(201);
  assert.equal(first.body.addresses.length, 1);
  assert.equal(first.body.addresses[0].isDefault, true);
  assert.equal(first.body.addresses[0].country, 'Ghana');
  homeId = first.body.addresses[0]._id;
  const second = await alice.post('/api/addresses').set(header).send({ ...address, label: 'Office' }).expect(201);
  officeId = second.body.addresses[1]._id;
  assert.equal(second.body.addresses.length, 2);
  assert.equal(second.body.addresses[0].isDefault, true);
  assert.equal(second.body.addresses[1].isDefault, false);
  assert.equal(String((await Address.findById(homeId))!.user), aliceId);
  assert.deepEqual((await bob.get('/api/addresses').expect(200)).body.addresses, []);
});

test('another user cannot read, edit, delete or select an address', async () => {
  await bob.get(`/api/addresses/${homeId}`).expect(404);
  await bob.patch(`/api/addresses/${homeId}`).set(header).send({ city: 'Kumasi' }).expect(404);
  await bob.delete(`/api/addresses/${homeId}`).set(header).expect(404);
  await bob.patch(`/api/addresses/${homeId}/default`).set(header).expect(404);
  const own = await alice.get(`/api/addresses/${homeId}`).expect(200);
  assert.equal(own.body.address.city, 'Accra');
});

test('switching defaults and editing retain all addresses and exactly one default', async () => {
  const switched = await alice.patch(`/api/addresses/${officeId}/default`).set(header).expect(200);
  assert.equal(switched.body.addresses.length, 2);
  assert.equal(switched.body.addresses.find((item: { _id: string }) => item._id === officeId).isDefault, true);
  const edited = await alice.patch(`/api/addresses/${officeId}`).set(header).send({ label: 'Office Updated', digitalAddress: 'GA-123-4567', landmark: 'Near the park', user: bobId }).expect(200);
  assert.equal(edited.body.addresses.filter((item: { isDefault: boolean }) => item.isDefault).length, 1);
  assert.equal(String((await Address.findById(officeId))!.user), aliceId);
  await alice.patch(`/api/addresses/${homeId}/default`).set(header).expect(200);
});

test('invalid IDs and address fields return clear errors', async () => {
  await alice.get('/api/addresses/not-an-id').expect(400);
  await alice.get(`/api/addresses/${new mongoose.Types.ObjectId()}`).expect(404);
  await alice.post('/api/addresses').set(header).send({ ...address, region: 'Invalid' }).expect(400);
  await alice.post('/api/addresses').set(header).send({ ...address, addressLine1: '' }).expect(400);
  await alice.post('/api/addresses').set(header).send({ ...address, label: 'x'.repeat(61) }).expect(400);
  await alice.post('/api/addresses').set(header).send({ ...address, isDefault: 'true' }).expect(400);
});

test('concurrent default selection preserves every address and one default', async () => {
  const responses = await Promise.all([alice.patch(`/api/addresses/${homeId}/default`).set(header), alice.patch(`/api/addresses/${officeId}/default`).set(header)]);
  responses.forEach((response) => assert.equal(response.status, 200));
  const list = await alice.get('/api/addresses').expect(200);
  assert.equal(list.body.addresses.length, 2);
  assert.equal(list.body.addresses.filter((item: { isDefault: boolean }) => item.isDefault).length, 1);
});

test('deleting the default chooses a replacement; deleting the last leaves no addresses', async () => {
  await alice.patch(`/api/addresses/${officeId}/default`).set(header).expect(200);
  const first = await alice.delete(`/api/addresses/${officeId}`).set(header).expect(200);
  assert.equal(first.body.addresses.length, 1);
  assert.equal(first.body.addresses[0].isDefault, true);
  assert.equal(first.body.addresses[0]._id, homeId);
  const last = await alice.delete(`/api/addresses/${homeId}`).set(header).expect(200);
  assert.deepEqual(last.body.addresses, []);
});

test('password changes verify current password and end other sessions; logout ends this one', async () => {
  const stale = browser(app);
  await stale.post('/api/auth/login').set(header).send({ email: 'alice@example.com', password }).expect(200);
  await alice.patch('/api/auth/password').set(header).send({ currentPassword: 'incorrect', newPassword: 'New-password-123' }).expect(400);
  await alice.patch('/api/auth/password').set(header).send({ currentPassword: password, newPassword: 'New-password-123' }).expect(200);
  await alice.get('/api/auth/me').expect(200);
  await stale.get('/api/auth/me').expect(401);
  await request(app).post('/api/auth/login').set(header).send({ email: 'alice@example.com', password }).expect(401);
  await alice.post('/api/auth/logout').set(header).expect(200);
  assert.equal((await alice.get('/api/auth/me').expect(200)).body.user, null);
  await alice.get('/api/addresses').expect(401);
  await alice.post('/api/auth/login').set(header).send({ email: 'alice@example.com', password: 'New-password-123' }).expect(200);
});

test('inactive users cannot log in or reuse existing sessions', async () => {
  await User.updateOne({ _id: bobId }, { $set: { isActive: false } });
  await bob.get('/api/auth/me').expect(401);
  await bob.post('/api/auth/login').set(header).send({ email: 'bob@example.com', password }).expect(403);
});

test('simultaneous first addresses keep both and assign one default', async () => {
  const responses = await Promise.all([
    alice.post('/api/addresses').set(header).send({ ...address, label: 'First' }),
    alice.post('/api/addresses').set(header).send({ ...address, label: 'Second' }),
  ]);
  responses.forEach((response) => assert.equal(response.status, 201));
  const list = await alice.get('/api/addresses').expect(200);
  assert.equal(list.body.addresses.length, 2);
  assert.equal(list.body.addresses.filter((item: { isDefault: boolean }) => item.isDefault).length, 1);
});

test('creation can explicitly select a new default; deleting a nondefault preserves it', async () => {
  const result = await alice.post('/api/addresses').set(header).send({ ...address, label: 'Family House', isDefault: true }).expect(201);
  const selected = result.body.addresses.find((item: { isDefault: boolean }) => item.isDefault);
  assert.equal(selected.label, 'Family House');
  assert.equal(result.body.addresses.length, 3);
  const normal = result.body.addresses.find((item: { isDefault: boolean }) => !item.isDefault);
  const deleted = await alice.delete(`/api/addresses/${normal._id}`).set(header).expect(200);
  assert.equal(deleted.body.addresses.length, 2);
  assert.equal(deleted.body.addresses.find((item: { isDefault: boolean }) => item.isDefault)._id, selected._id);
});

test('authentication rate limit rejects excess attempts', async () => {
  await RateLimit.deleteMany({});
  const limited = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 1 });
  await request(limited).post('/api/auth/login').set(header).send({ email: 'not-an-email', password }).expect(400);
  const response = await request(limited).post('/api/auth/login').set(header).send({ email: 'not-an-email', password }).expect(429);
  assert.ok(response.headers['retry-after']);
});
