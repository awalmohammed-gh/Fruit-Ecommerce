import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { browser } from './agent.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { pricing as configured } from '../config/pricing.js';
import DeliveryAssignment from '../models/DeliveryAssignment.js';
import { becomePartner, header } from './partners.js';

const adminLogin = { email: 'owner@greenfarm.test', password: 'Static-admin-pass' };
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 1000, secureCookies: false, sameSite: 'lax', admin: adminLogin });
const admin = browser(app);
const ama = browser(app);
const kofi = browser(app);
const rider = browser(app);
const otherRider = browser(app);
const password = 'Test-password-123';
const base = { description: 'Fresh from the farm', image: 'https://example.com/item.png', unit: '1kg', category: 'fruits-vegetables', isOrganic: false };
const address = { label: 'Home', fullName: 'Ama Owusu', phone: '0241234567', addressLine1: '4 Oxford Street', city: 'Accra', region: 'Greater Accra' };
let database: MongoMemoryReplSet;
let mango: string;
let cheese: string;
let amaAddress: string;
let riderId: string;
let deliveryId: string;
let orderId: string;
let otp: string;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_orders_test'));
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  mango = (await admin.post('/api/products').set(header).send({ ...base, name: 'Mango', price: 20, originalPrice: 25, stock: 5 }).expect(201)).body.product._id;
  cheese = (await admin.post('/api/products').set(header).send({ ...base, name: 'Cheese', price: 130, stock: 2 }).expect(201)).body.product._id;
  await ama.post('/api/auth/register').set(header).send({ fullName: 'Ama Owusu', email: 'ama@example.com', phone: '0241234567', password }).expect(201);
  amaAddress = (await ama.post('/api/addresses').set(header).send(address).expect(201)).body.addresses[0]._id;
  await kofi.post('/api/auth/register').set(header).send({ fullName: 'Kofi Mensah', email: 'kofi@example.com', password }).expect(201);
  riderId = await becomePartner(admin, rider, 'yaw@example.com', 'Yaw Rider');
  await becomePartner(admin, otherRider, 'efua@example.com', 'Efua Rider');
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('pricing comes from the server and quotes flag stock problems instead of failing', async () => {
  const { pricing } = (await request(app).get('/api/orders/pricing').expect(200)).body;
  assert.deepEqual(pricing, configured, 'the storefront gets exactly the configured pricing');
  const { quote } = (await request(app).post('/api/orders/quote').set(header).send({ items: [{ productId: mango, quantity: 2, price: 1 }, { productId: cheese, quantity: 3 }] }).expect(200)).body;
  assert.equal(quote.subtotal, 20 * 2 + 130 * 3);
  assert.equal(quote.deliveryFee, 0);
  assert.equal(quote.tax, 43);
  assert.deepEqual(quote.problems, [{ productId: cheese, name: 'Cheese', reason: 'insufficient_stock', available: 2 }]);
  await request(app).post('/api/orders/quote').set(header).send({ items: [] }).expect(400);
});

test('customers place orders from their own address; client prices are ignored and stock is reserved', async () => {
  await request(app).post('/api/orders').set(header).send({ addressId: amaAddress, paymentMethod: 'cash', items: [{ productId: mango, quantity: 1 }] }).expect(401);
  await kofi.post('/api/orders').set(header).send({ addressId: amaAddress, paymentMethod: 'cash', items: [{ productId: mango, quantity: 1 }] }).expect(404);
  await ama.post('/api/orders').set(header).send({ addressId: amaAddress, paymentMethod: 'card', items: [{ productId: mango, quantity: 1 }] }).expect(400);
  await ama.post('/api/orders').set(header).send({ addressId: amaAddress, paymentMethod: 'cash', items: [{ productId: cheese, quantity: 3 }] }).expect(409);

  const { order } = (await ama.post('/api/orders').set(header).send({ addressId: amaAddress, paymentMethod: 'cash', items: [{ productId: mango, quantity: 2, price: 0.01 }, { productId: mango, quantity: 1 }] }).expect(201)).body;
  orderId = order._id;
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].quantity, 3);
  assert.equal(order.items[0].price, 20);
  assert.equal(order.subtotal, 60);
  assert.equal(order.deliveryFee, 23);
  assert.equal(order.tax, 6);
  assert.equal(order.total, 89);
  assert.equal(order.status, 'Order Placed');
  assert.equal(order.shippingAddress.city, 'Accra');
  assert.equal(order.number, String(order._id).slice(-8).toUpperCase());
  assert.equal(order.deliveryOtp, undefined, 'code is hidden until a partner is assigned');
  assert.equal((await Product.findById(mango))!.stock, 2);

  const mine = (await ama.get('/api/orders').expect(200)).body.orders;
  assert.equal(mine.length, 1);
  assert.equal((await kofi.get('/api/orders').expect(200)).body.orders.length, 0);
  await kofi.get(`/api/orders/${orderId}`).expect(404);
});

test('approved partners only see and update their own deliveries, one step at a time', async () => {
  await ama.get('/api/admin/delivery/partners').expect(401);
  const listed = (await admin.get('/api/admin/orders?q=ama').expect(200)).body;
  assert.equal(listed.orders.length, 1);
  assert.equal(listed.orders[0].deliveryOtp, undefined, 'admins never see the code');
  assert.equal(listed.counts.pending, 1);
  await admin.patch(`/api/admin/orders/${orderId}/status`).set(header).send({ status: 'Assigned' }).expect(400);
  await admin.patch(`/api/admin/orders/${orderId}/status`).set(header).send({ status: 'Delivered' }).expect(400);
  await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: riderId }).expect(409);
  await admin.patch(`/api/admin/orders/${orderId}/status`).set(header).send({ status: 'Confirmed' }).expect(200);
  const assigned = (await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: riderId, notes: 'Call on arrival' }).expect(200)).body.order;
  assert.equal(assigned.status, 'Assigned');
  assert.equal(assigned.deliveryStatus, 'Assigned');
  assert.equal(assigned.deliveryPartner.fullName, 'Yaw Rider');
  assert.equal(assigned.assignments.length, 1);
  await admin.patch(`/api/admin/orders/${orderId}/status`).set(header).send({ status: 'Packed' }).expect(409);

  otp = (await ama.get(`/api/orders/${orderId}`).expect(200)).body.order.deliveryOtp;
  assert.match(otp, /^\d{6}$/);
  const portal = (await rider.get('/api/delivery/deliveries').expect(200)).body;
  assert.equal(portal.deliveries.length, 1);
  deliveryId = portal.deliveries[0]._id;
  assert.equal(portal.deliveries[0].order.number, assigned.number);
  assert.equal(portal.deliveries[0].notes, 'Call on arrival');
  assert.equal(JSON.stringify(portal).includes(otp), false, 'partners must get the code from the customer');
  assert.equal(JSON.stringify(portal).includes('ama@example.com'), false, 'partners only get what the delivery needs');
  assert.equal((await otherRider.get('/api/delivery/deliveries').expect(200)).body.deliveries.length, 0);
  await otherRider.patch(`/api/delivery/deliveries/${deliveryId}/status`).set(header).send({ status: 'Accepted' }).expect(404);

  const step = (status: string) => rider.patch(`/api/delivery/deliveries/${deliveryId}/status`).set(header).send({ status });
  await step('Picked Up').expect(409);
  await rider.patch(`/api/delivery/deliveries/${deliveryId}/location`).set(header).send({ lat: 5.6, lng: -0.18 }).expect(409);
  await step('Accepted').expect(200);
  assert.equal((await ama.get(`/api/orders/${orderId}`).expect(200)).body.order.status, 'Assigned');
  await step('Picked Up').expect(200);
  assert.equal((await ama.get(`/api/orders/${orderId}`).expect(200)).body.order.status, 'Out for Delivery');
  await rider.post(`/api/delivery/deliveries/${deliveryId}/deliver`).set(header).send({ otp }).expect(409);
  await step('On The Way').expect(200);
  await step('On The Way').expect(409);
  await rider.patch(`/api/delivery/deliveries/${deliveryId}/location`).set(header).send({ lat: 5.6037, lng: -0.187 }).expect(200);
  assert.equal((await ama.get(`/api/orders/${orderId}`).expect(200)).body.order.liveLocation.lat, 5.6037);
  await ama.post(`/api/orders/${orderId}/cancel`).set(header).expect(409);
});

test('delivery needs the customer code, marks cash paid and unlocks reviews', async () => {
  await ama.post(`/api/products/${mango}/reviews`).set(header).send({ rating: 5 }).expect(403);
  const wrong = otp === '000000' ? '111111' : '000000';
  await rider.post(`/api/delivery/deliveries/${deliveryId}/deliver`).set(header).send({ otp: wrong }).expect(400);
  // Non-ASCII input of the same length is just a wrong code, not a server error.
  await rider.post(`/api/delivery/deliveries/${deliveryId}/deliver`).set(header).send({ otp: 'ééé' }).expect(400);
  const delivered = (await rider.post(`/api/delivery/deliveries/${deliveryId}/deliver`).set(header).send({ otp }).expect(200)).body.delivery;
  assert.equal(delivered.status, 'Delivered');
  assert.equal(delivered.order.isPaid, true);
  const order = (await ama.get(`/api/orders/${orderId}`).expect(200)).body.order;
  assert.equal(order.status, 'Delivered');
  assert.equal(order.deliveryStatus, 'Delivered');
  assert.equal((await ama.get(`/api/orders/${orderId}`).expect(200)).body.order.deliveryOtp, undefined);
  await admin.patch(`/api/admin/orders/${orderId}/status`).set(header).send({ status: 'Cancelled' }).expect(409);

  assert.equal((await ama.get(`/api/products/${mango}/reviews/mine`).expect(200)).body.canReview, true);
  await ama.post(`/api/products/${mango}/reviews`).set(header).send({ rating: 6 }).expect(400);
  await ama.post(`/api/products/${mango}/reviews`).set(header).send({ rating: 4, comment: 'Sweet and ripe' }).expect(200);
  await ama.post(`/api/products/${mango}/reviews`).set(header).send({ rating: 5, comment: 'Even better the second time' }).expect(200);
  await kofi.post(`/api/products/${mango}/reviews`).set(header).send({ rating: 1 }).expect(403);
  const reviews = (await request(app).get(`/api/products/${mango}/reviews`).expect(200)).body;
  assert.equal(reviews.reviews.length, 1, 'one review per customer, updated in place');
  assert.equal(reviews.reviews[0].authorName, 'Ama Owusu');
  assert.equal(reviews.reviews[0].user, undefined);
  assert.deepEqual(reviews.summary, { average: 5, count: 1, stars: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const product = (await request(app).get(`/api/products/${mango}`).expect(200)).body.product;
  assert.equal(product.rating, 5);
  assert.equal(product.reviewCount, 1);
});

test('cancelling returns stock exactly once and closes any open delivery', async () => {
  const place = async (quantity: number) => (await ama.post('/api/orders').set(header).send({ addressId: amaAddress, paymentMethod: 'cash', items: [{ productId: mango, quantity }] }).expect(201)).body.order._id;
  const stock = async () => (await Product.findById(mango))!.stock;

  const first = await place(1);
  assert.equal(await stock(), 1);
  await ama.post(`/api/orders/${first}/cancel`).set(header).expect(200);
  assert.equal(await stock(), 2);
  await ama.post(`/api/orders/${first}/cancel`).set(header).expect(409);
  assert.equal(await stock(), 2);

  const second = await place(2);
  assert.equal(await stock(), 0);
  await ama.post('/api/orders').set(header).send({ addressId: amaAddress, paymentMethod: 'cash', items: [{ productId: mango, quantity: 1 }] }).expect(409);
  await admin.patch(`/api/admin/orders/${second}/status`).set(header).send({ status: 'Cancelled' }).expect(200);
  await admin.patch(`/api/admin/orders/${second}/status`).set(header).send({ status: 'Cancelled' }).expect(200);
  assert.equal(await stock(), 2);

  const third = await place(1);
  await admin.patch(`/api/admin/orders/${third}/status`).set(header).send({ status: 'Confirmed' }).expect(200);
  await admin.patch(`/api/admin/orders/${third}/partner`).set(header).send({ partnerId: riderId }).expect(200);
  await admin.patch(`/api/admin/orders/${third}/status`).set(header).send({ status: 'Cancelled' }).expect(200);
  assert.equal(await stock(), 2);
  const closed = await DeliveryAssignment.findOne({ order: third });
  assert.equal(closed!.status, 'Cancelled');
  assert.equal(closed!.active, false);
  assert.equal((await rider.get('/api/delivery/deliveries').expect(200)).body.deliveries.length, 0);
  assert.equal((await Order.findById(third))!.deliveryStatus, 'Cancelled');
});

test('admin revenue figures come from stored orders and exclude cancellations', async () => {
  const { summary } = (await admin.get('/api/admin/orders/summary').expect(200)).body;
  assert.equal(summary.orders, 4);
  assert.equal(summary.stages.completed, 1);
  assert.equal(summary.stages.cancelled, 3);
  assert.deepEqual(summary.allTime, { revenue: 89, orders: 1 });
  assert.deepEqual(summary.periods.today, { revenue: 89, orders: 1 });
  assert.deepEqual(summary.periods.lastMonth, { revenue: 0, orders: 0 });

  const daily = (await admin.get('/api/admin/orders/revenue?granularity=daily').expect(200)).body.buckets;
  assert.equal(daily.length, 14);
  assert.equal(daily[13].revenue, 89);
  assert.equal((await admin.get('/api/admin/orders/revenue?granularity=monthly').expect(200)).body.buckets.length, 12);
  await admin.get('/api/admin/orders/revenue?granularity=hourly').expect(400);

  const products = (await admin.get('/api/admin/orders/products').expect(200)).body.products;
  assert.deepEqual(products.map((row: { name: string; units: number; revenue: number; stock: number }) => [row.name, row.units, row.revenue, row.stock]), [['Mango', 3, 60, 2]]);

  const customers = (await admin.get('/api/admin/customers?q=ama').expect(200)).body.customers;
  assert.equal(customers[0].orders, 4);
  assert.equal(customers[0].totalSpent, 89);
  await ama.get('/api/admin/orders/summary').expect(401);
});
