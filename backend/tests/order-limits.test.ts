import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import { orderLimits } from '../config/orderLimits.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { cancelUnconfirmedOrders } from '../services/orders.js';
import { browser } from './agent.js';
import { header } from './partners.js';

const adminLogin = { email: 'limits@greenfarm.test', password: 'Static-admin-pass' };
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 1000, secureCookies: false, sameSite: 'lax', admin: adminLogin });
const admin = browser(app);
const shopper = browser(app);
const password = 'Test-password-123';
let database: MongoMemoryReplSet;
let rice: string;
let addressId: string;

const order = (quantity = 1, key?: string) => {
  const sent = shopper.post('/api/orders').set(header);
  if (key) sent.set('Idempotency-Key', key);
  return sent.send({ addressId, paymentMethod: 'cash', items: [{ productId: rice, quantity }] });
};
const stock = async () => (await Product.findById(rice))!.stock;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_order_limits_test'));
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  rice = (await admin.post('/api/products').set(header).send({ name: 'Jasmine Rice', description: 'Long grain', image: 'https://example.com/rice.png', unit: '5kg', category: 'pantry', price: 90, stock: 100 }).expect(201)).body.product._id;
  await shopper.post('/api/auth/register').set(header).send({ fullName: 'Yaa Buyer', email: 'yaa@example.com', password }).expect(201);
  addressId = (await shopper.post('/api/addresses').set(header).send({ label: 'Home', fullName: 'Yaa Buyer', phone: '0245550000', addressLine1: '9 Palm Road', city: 'Accra', region: 'Greater Accra' }).expect(201)).body.addresses[0]._id;
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('one order holds at most 20 of a product, however the lines are split', async () => {
  assert.equal((await request(app).get('/api/orders/pricing').expect(200)).body.limits.maxPerProduct, orderLimits.maxPerProduct);
  const tooMany = await order(orderLimits.maxPerProduct + 1).expect(400);
  assert.match(tooMany.body.message, /up to 20 of each product/);
  await shopper.post('/api/orders/quote').set(header).send({ items: [{ productId: rice, quantity: 15 }, { productId: rice, quantity: 6 }] }).expect(400);
  assert.equal(await stock(), 100);
});

test('the same checkout sent twice creates one order', async () => {
  const key = randomUUID();
  const first = await order(2, key);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const repeat = await order(2, key).expect(200);
  assert.equal(repeat.body.order._id, first.body.order._id);
  // Both sends at the same moment.
  const raceKey = randomUUID();
  const [a, b] = await Promise.all([order(1, raceKey), order(1, raceKey)]);
  assert.equal(a.body.order._id, b.body.order._id);
  assert.equal(await Order.countDocuments({ user: first.body.order.user }), 2);
  assert.equal(await stock(), 97, 'stock taken once per order');
  await order(1, 'too-short').expect(400);
  // Another customer can't fetch someone's order by reusing their key.
  const other = browser(app);
  await other.post('/api/auth/register').set(header).send({ fullName: 'Other Buyer', email: 'other@example.com', password }).expect(201);
  const otherAddress = (await other.post('/api/addresses').set(header).send({ label: 'Home', fullName: 'Other', phone: '0245550001', addressLine1: '1 Road', city: 'Accra', region: 'Greater Accra' }).expect(201)).body.addresses[0]._id;
  const theirs = await other.post('/api/orders').set(header).set('Idempotency-Key', key).send({ addressId: otherAddress, paymentMethod: 'cash', items: [{ productId: rice, quantity: 1 }] }).expect(201);
  assert.notEqual(theirs.body.order._id, first.body.order._id);
});

test('a customer can have at most 3 orders waiting for confirmation', async () => {
  // Two are already waiting from the previous test.
  await order(1).expect(201);
  const blocked = await order(1).expect(409);
  assert.match(blocked.body.message, /3 orders waiting for GreenFarm to confirm/);
  const waiting = await Order.find({ status: 'Order Placed', 'customer.email': 'yaa@example.com' });
  await admin.patch(`/api/admin/orders/${waiting[0]!._id}/status`).set(header).send({ status: 'Confirmed' }).expect(200);
  await order(1).expect(201);
});

test('orders nobody confirms within 24 hours are cancelled and their stock returned', async () => {
  const before = await stock();
  const waiting = await Order.find({ status: 'Order Placed', 'customer.email': 'yaa@example.com' }).sort({ createdAt: 1 });
  const units = waiting.reduce((sum, entry) => sum + entry.items[0]!.quantity, 0);
  const old = new Date(Date.now() - (orderLimits.confirmWithinHours + 1) * 3_600_000);
  await Order.collection.updateMany({ _id: { $in: waiting.map((entry) => entry._id) } }, { $set: { createdAt: old } });
  const confirmed = await Order.findOne({ status: 'Confirmed', 'customer.email': 'yaa@example.com' });
  await Order.collection.updateOne({ _id: confirmed!._id }, { $set: { createdAt: old } });

  assert.equal(await cancelUnconfirmedOrders(), waiting.length);
  assert.equal(await stock(), before + units);
  const cancelled = (await shopper.get(`/api/orders/${waiting[0]!._id}`).expect(200)).body.order;
  assert.equal(cancelled.status, 'Cancelled');
  assert.match(cancelled.cancelReason, /not confirmed within 24 hours/);
  assert.equal((await Order.findById(confirmed!._id))!.status, 'Confirmed', 'confirmed orders are never touched');
  assert.equal(await cancelUnconfirmedOrders(), 0, 'running again changes nothing');
  assert.equal(await stock(), before + units, 'stock is returned only once');
  await order(1).expect(201);
});
