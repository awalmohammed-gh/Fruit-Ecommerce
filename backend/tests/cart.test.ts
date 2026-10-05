import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { browser, cookie, cookieFrom } from './agent.js';
import { becomePartner, header } from './partners.js';

const adminLogin = { email: 'cart-admin@greenfarm.test', password: 'Static-admin-pass' };
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), admin: adminLogin, authLimit: 1000, secureCookies: false, sameSite: 'lax' });
const alice = browser(app), bob = browser(app), admin = browser(app), partner = browser(app);
const password = 'Test-password-123';
let database: MongoMemoryReplSet;
let aliceId: string, bobId: string, productId: string, addressId: string;
let aliceCookie: string;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_cart_test'));
  await Cart.init();
  const registered = await alice.post('/api/auth/register').set(header).send({ fullName: 'Alice Cart', email: 'alice-cart@example.com', password }).expect(201);
  aliceId = registered.body.user._id;
  aliceCookie = cookie('customerToken', cookieFrom(registered, 'customerToken')!);
  assert.match((registered.headers['set-cookie'] as unknown as string[]).join(';'), /HttpOnly/);
  assert.equal(registered.body.token, undefined);
  bobId = (await bob.post('/api/auth/register').set(header).send({ fullName: 'Bob Cart', email: 'bob-cart@example.com', password }).expect(201)).body.user._id;
  productId = String((await Product.create({ name: 'Cart mango', description: 'Fresh mango', price: 20, originalPrice: 25, stock: 100, image: 'https://example.com/mango.png', category: 'fruit', unit: 'kg' }))._id);
  addressId = (await alice.post('/api/addresses').set(header).send({ label: 'Home', fullName: 'Alice Cart', phone: '0241234567', addressLine1: '12 Palm Street', city: 'Accra', region: 'Greater Accra' }).expect(201)).body.addresses[0]._id;
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  await becomePartner(admin, partner, 'cart-rider@example.com', 'Cart Rider');
});
beforeEach(async () => {
  await Cart.deleteMany({});
  await Product.updateOne({ _id: productId }, { price: 20, originalPrice: 25, stock: 100 });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('every cart endpoint requires a customer cookie; admin and partner cookies cannot substitute', async () => {
  for (const agent of [request(app), admin, partner]) {
    await agent.get('/api/cart').expect(401);
    await agent.post('/api/cart').set(header).send({ productId, quantity: 1 }).expect(401);
    await agent.patch(`/api/cart/${productId}`).set(header).send({ quantity: 2 }).expect(401);
    await agent.delete(`/api/cart/${productId}`).set(header).expect(401);
    await agent.delete('/api/cart').set(header).expect(401);
  }
  await alice.post('/api/cart').send({ productId, quantity: 1 }).expect(403);
});

test('cart survives a new page/client through the cookie and stores only references and quantities', async () => {
  await alice.post('/api/cart').set(header).send({ productId, quantity: 2, user: bobId, price: 0.01, product: { price: 0.01 } }).expect(200);
  const restored = await request(app).get('/api/cart').set('Cookie', aliceCookie).expect(200);
  assert.equal(restored.body.ownerId, aliceId);
  assert.equal(restored.body.items[0].quantity, 2);
  assert.equal(restored.body.items[0].product.price, 20);
  const stored = await Cart.findOne({ user: aliceId }).lean();
  assert.equal(String(stored!.items[0]!.product), productId);
  assert.deepEqual(Object.keys(stored!.items[0]!).sort(), ['product', 'quantity']);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', aliceCookie).expect(200)).body.user._id, aliceId);
});

test('customers cannot read, update, remove or clear another customer cart', async () => {
  await alice.post('/api/cart').set(header).send({ productId, quantity: 3 }).expect(200);
  assert.deepEqual((await bob.get(`/api/cart?user=${aliceId}`).expect(200)).body.items, []);
  await bob.patch(`/api/cart/${productId}`).set(header).send({ quantity: 7, user: aliceId }).expect(404);
  await bob.delete(`/api/cart/${productId}`).set(header).expect(200);
  await bob.delete('/api/cart').set(header).send({ user: aliceId }).expect(200);
  assert.equal((await alice.get('/api/cart').expect(200)).body.items[0].quantity, 3);
  await bob.post('/api/cart').set(header).send({ productId, quantity: 1 }).expect(200);
  assert.equal((await bob.get('/api/cart').expect(200)).body.items[0].quantity, 1);
});

test('stale owner headers cannot redirect a request after the shared cookie changes account', async () => {
  await bob.get('/api/cart').set('X-Cart-Owner', aliceId).expect(409);
  await bob.post('/api/cart').set(header).set('X-Cart-Owner', aliceId).send({ productId, quantity: 1 }).expect(409);
  assert.equal(await Cart.countDocuments(), 0);
  assert.equal((await bob.get('/api/cart').set('X-Cart-Owner', bobId).expect(200)).body.ownerId, bobId);
});

test('invalid IDs, malformed input and quantities are rejected, and additions obey stock/order limits', async () => {
  for (const quantity of [0, -1, 1.5, 21, '2', null]) {
    await alice.post('/api/cart').set(header).send({ productId, quantity }).expect(400);
  }
  await alice.post('/api/cart').set(header).send([]).expect(400);
  await alice.post('/api/cart').set(header).send({ productId: 'invalid', quantity: 1 }).expect(400);
  await alice.post('/api/cart').set(header).send({ productId: String(new mongoose.Types.ObjectId()), quantity: 1 }).expect(404);
  await alice.post('/api/cart').set(header).send({ productId, quantity: 1 }).expect(200);
  const uppercase = await alice.post('/api/cart').set(header).send({ productId: productId.toUpperCase(), quantity: 2 }).expect(200);
  assert.equal(uppercase.body.items.length, 1, 'ID casing cannot create duplicate product lines');
  assert.equal(uppercase.body.items[0].quantity, 3);
  await alice.patch(`/api/cart/${productId.toUpperCase()}`).set(header).send({ quantity: 4 }).expect(200);
  await alice.delete(`/api/cart/${productId.toUpperCase()}`).set(header).expect(200);
  await alice.post('/api/cart').set(header).send({ productId, quantity: 15 }).expect(200);
  const capped = await alice.post('/api/cart').set(header).send({ productId, quantity: 15 }).expect(200);
  assert.equal(capped.body.items[0].quantity, 20);
  await alice.patch(`/api/cart/${productId}`).set(header).send({ quantity: 21 }).expect(400);
  await alice.patch(`/api/cart/${productId}`).set(header).send({ quantity: 4 }).expect(200);
  await alice.delete(`/api/cart/${productId}`).set(header).expect(200);
  assert.deepEqual((await alice.get('/api/cart').expect(200)).body.items, []);
  await Product.updateOne({ _id: productId }, { stock: 2 });
  assert.equal((await alice.post('/api/cart').set(header).send({ productId, quantity: 5 }).expect(200)).body.items[0].quantity, 2);
  await Product.updateOne({ _id: productId }, { stock: 0 });
  await alice.post('/api/cart').set(header).send({ productId, quantity: 1 }).expect(409);
});

test('concurrent additions, including the first cart creation, do not lose quantities', async () => {
  const responses = await Promise.all(Array.from({ length: 6 }, () => alice.post('/api/cart').set(header).send({ productId, quantity: 1 })));
  for (const response of responses) assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal((await alice.get('/api/cart').expect(200)).body.items[0].quantity, 6);
  assert.equal(await Cart.countDocuments({ user: aliceId }), 1);
});

test('cart reloads current database prices and hides deleted products', async () => {
  await alice.post('/api/cart').set(header).send({ productId, quantity: 1 }).expect(200);
  await Product.updateOne({ _id: productId }, { price: 22 });
  assert.equal((await alice.get('/api/cart').expect(200)).body.items[0].product.price, 22);
  const temporary = await Product.create({ name: 'Temporary fruit', description: 'Fruit', price: 5, stock: 5, image: 'https://example.com/fruit.png', category: 'fruit', unit: 'kg' });
  await alice.post('/api/cart').set(header).send({ productId: String(temporary._id), quantity: 1 }).expect(200);
  await temporary.deleteOne();
  assert.equal((await alice.get('/api/cart').expect(200)).body.items.length, 1);
});

test('checkout failure retains the cart; successful order clears it atomically and retry preserves subsequent additions', async () => {
  await alice.post('/api/cart').set(header).send({ productId, quantity: 2 }).expect(200);
  const input = { addressId, paymentMethod: 'cash', items: [{ productId, quantity: 2 }] };
  await Product.updateOne({ _id: productId }, { stock: 1 });
  await alice.post('/api/orders').set(header).send(input).expect(409);
  assert.equal((await alice.get('/api/cart').expect(200)).body.items[0].quantity, 2);
  await Product.updateOne({ _id: productId }, { stock: 100 });
  const key = randomUUID();
  const created = await alice.post('/api/orders').set(header).set('Idempotency-Key', key).send(input).expect(201);
  assert.deepEqual((await alice.get('/api/cart').expect(200)).body.items, []);
  await alice.post('/api/cart').set(header).send({ productId, quantity: 1 }).expect(200);
  const retry = await alice.post('/api/orders').set(header).set('Idempotency-Key', key).send(input).expect(200);
  assert.equal(retry.body.order._id, created.body.order._id);
  assert.equal((await alice.get('/api/cart').expect(200)).body.items[0].quantity, 1);
});

test('logout revokes the cookie without losing the customer cart; login restores only that customer cart', async () => {
  await alice.post('/api/cart').set(header).send({ productId, quantity: 2 }).expect(200);
  await alice.post('/api/auth/logout').set(header).expect(200);
  await alice.get('/api/cart').expect(401);
  await request(app).get('/api/cart').set('Cookie', aliceCookie).expect(401);
  assert.equal((await alice.get('/api/auth/me').expect(200)).body.user, null);
  assert.deepEqual((await bob.get('/api/cart').expect(200)).body.items, []);
  await alice.post('/api/auth/login').set(header).send({ email: 'alice-cart@example.com', password }).expect(200);
  assert.equal((await alice.get('/api/cart').expect(200)).body.items[0].quantity, 2);
});
