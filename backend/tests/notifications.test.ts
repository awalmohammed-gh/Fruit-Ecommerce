import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import Notification, { NOTIFICATION_RETENTION_MS } from '../models/Notification.js';
import NotificationReceipt from '../models/NotificationReceipt.js';
import { createNotification } from '../services/notifications.js';
import { browser, cookie, cookieFrom } from './agent.js';
import { application, becomePartner, header } from './partners.js';
import type { AccountType } from '../models/Session.js';
import Product from '../models/Product.js';

const adminLogin = { email: 'notifications@greenfarm.test', password: 'Admin-test-password' };
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), admin: adminLogin, authLimit: 1000, secureCookies: false, sameSite: 'lax' });
const alice = browser(app), bob = browser(app), admin = browser(app), partner = browser(app);
const password = 'Customer-test-password';
let database: MongoMemoryReplSet;
let aliceId: string, bobId: string, partnerId: string, productId: string, addressId: string;
let aliceCookie: string;
const privateNotice = (recipient: string, account: AccountType = 'customer', title = 'Private update') => createNotification({ audience: 'individual', recipient, recipientAccount: account, title, message: 'Private message', type: 'order' });
const broadcast = (audience: 'customers' | 'all' = 'customers') => createNotification({ audience, title: 'Store update', message: 'Holiday opening hours', type: 'system' });

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_notifications_test'));
  const registered = await alice.post('/api/auth/register').set(header).send({ fullName: 'Alice Notify', email: 'alice-notify@example.com', password }).expect(201);
  aliceId = registered.body.user._id;
  aliceCookie = cookie('customerToken', cookieFrom(registered, 'customerToken')!);
  bobId = (await bob.post('/api/auth/register').set(header).send({ fullName: 'Bob Notify', email: 'bob-notify@example.com', password }).expect(201)).body.user._id;
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  partnerId = await becomePartner(admin, partner, 'notify-partner@example.com', 'Notify Partner');
  productId = String((await Product.create({ name: 'Notify mango', description: 'Fresh mango', price: 20, originalPrice: 25, stock: 100, image: 'https://example.com/mango.png', category: 'fruit', unit: 'kg' }))._id);
  addressId = (await alice.post('/api/addresses').set(header).send({ label: 'Home', fullName: 'Alice Notify', phone: '0241234567', addressLine1: '12 Palm Street', city: 'Accra', region: 'Greater Accra' }).expect(201)).body.addresses[0]._id;
});
beforeEach(async () => { await Notification.deleteMany({}); await NotificationReceipt.deleteMany({}); });
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('all APIs require the correct HTTP-only account cookie and cannot be unlocked with a frontend role or token', async () => {
  for (const path of ['/api/notifications', '/api/admin/notifications', '/api/delivery/notifications']) {
    await request(app).get(path).expect(401);
    await request(app).get(`${path}/unread-count`).expect(401);
    await request(app).patch(`${path}/read-all`).set(header).send({ ids: [] }).expect(401);
  }
  await alice.get('/api/admin/notifications').expect(401);
  await admin.get('/api/notifications').expect(401);
  await partner.get('/api/notifications').expect(401);
  await alice.post('/api/notifications/broadcast').set(header).send({ audience: 'all', title: 'Forged', message: 'Bad', type: 'system', role: 'admin' }).expect(403);
});

test('private notifications are scoped to one account even with a forged user ID or known private notification ID', async () => {
  const own = await privateNotice(aliceId);
  const other = await privateNotice(bobId, 'customer', 'Bob-only update');
  const result = await alice.get(`/api/notifications?userId=${bobId}`).expect(200);
  assert.deepEqual(result.body.notifications.map((item: { _id: string }) => item._id), [String(own._id)]);
  assert.equal(result.body.notifications[0].recipient, undefined);
  assert.equal(result.body.notifications[0].createdBy, undefined);
  await bob.patch(`/api/notifications/${own._id}/read`).set(header).expect(404);
  await bob.delete(`/api/notifications/${own._id}`).set(header).expect(404);
  await alice.patch(`/api/notifications/${other._id}/read`).set(header).expect(404);
  assert.equal((await bob.get('/api/notifications').expect(200)).body.notifications[0]._id, String(other._id));
  await bob.get('/api/notifications').set('X-Notification-Owner', aliceId).expect(409);
  await bob.patch(`/api/notifications/${other._id}/read`).set(header).set('X-Notification-Owner', aliceId).expect(409);
});

test('customer broadcasts exclude admin/partners; Everyone includes all existing account types', async () => {
  const customer = await broadcast('customers');
  const everyone = await broadcast('all');
  const internal = await privateNotice('admin', 'admin', 'Internal management update');
  const delivery = await privateNotice(partnerId, 'partner', 'Partner-only update');
  assert.equal((await alice.get('/api/notifications').expect(200)).body.notifications.length, 2);
  assert.equal((await bob.get('/api/notifications').expect(200)).body.notifications.length, 2);
  const adminIds = (await admin.get('/api/admin/notifications').expect(200)).body.notifications.map((item: { _id: string }) => item._id);
  assert.deepEqual(adminIds, [String(internal._id), String(everyone._id)]);
  const partnerIds = (await partner.get('/api/delivery/notifications').expect(200)).body.notifications.map((item: { _id: string }) => item._id);
  assert.deepEqual(partnerIds, [String(delivery._id), String(everyone._id)]);
  await admin.patch(`/api/admin/notifications/${customer._id}/read`).set(header).expect(404);
  await alice.patch(`/api/notifications/${internal._id}/read`).set(header).expect(404);
  await alice.patch(`/api/notifications/${delivery._id}/read`).set(header).expect(404);
});

test('broadcast reads and unread counts remain independent; repeated/concurrent read requests are idempotent', async () => {
  const notice = await broadcast('all');
  const responses = await Promise.all(Array.from({ length: 6 }, () => alice.patch(`/api/notifications/${notice._id}/read`).set(header)));
  for (const response of responses) assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(await NotificationReceipt.countDocuments({ notification: notice._id, accountId: aliceId }), 1);
  assert.equal((await alice.get('/api/notifications/unread-count').expect(200)).body.unreadCount, 0);
  assert.equal((await bob.get('/api/notifications/unread-count').expect(200)).body.unreadCount, 1);
  assert.equal((await admin.get('/api/admin/notifications/unread-count').expect(200)).body.unreadCount, 1);
  assert.equal((await partner.get('/api/delivery/notifications/unread-count').expect(200)).body.unreadCount, 1);
  assert.equal((await alice.get('/api/notifications').expect(200)).body.notifications[0].isRead, true);
  assert.equal((await bob.get('/api/notifications').expect(200)).body.notifications[0].isRead, false);
  assert.equal(await Notification.countDocuments(), 1, 'reading never deletes a broadcast');
});

test('read-all covers only the visible authorized IDs and dismissing a broadcast affects only one account', async () => {
  const shared = await broadcast();
  const a = await privateNotice(aliceId);
  const b = await privateNotice(bobId);
  await alice.patch('/api/notifications/read-all').set(header).send({ ids: [String(shared._id), String(b._id)] }).expect(200);
  assert.equal((await alice.get('/api/notifications/unread-count').expect(200)).body.unreadCount, 1, 'unselected own private notification remains unread');
  assert.equal((await bob.get('/api/notifications/unread-count').expect(200)).body.unreadCount, 2);
  assert.equal(await NotificationReceipt.countDocuments({ notification: b._id }), 0);
  await alice.delete(`/api/notifications/${shared._id}`).set(header).expect(200);
  assert.deepEqual((await alice.get('/api/notifications').expect(200)).body.notifications.map((item: { _id: string }) => item._id), [String(a._id)]);
  assert.equal((await bob.get('/api/notifications').expect(200)).body.notifications.length, 2);
  assert.equal(await Notification.countDocuments(), 3);
});

test('management broadcasts validate audience, fields, CSRF and safe internal links', async () => {
  const input = { audience: 'customers', title: 'Opening hours', message: 'We close at 4 PM', type: 'custom-type', link: '/products?sort=price_asc' };
  await admin.post('/api/admin/notifications/broadcast').send(input).expect(403);
  const created = await admin.post('/api/admin/notifications/broadcast').set(header).send({ ...input, recipient: bobId, createdBy: 'forged' }).expect(201);
  const stored = await Notification.findById(created.body.notification._id);
  assert.equal(stored!.createdBy, 'admin');
  assert.equal(stored!.recipient, null);
  assert.equal(stored!.type, 'custom-type');
  for (const audience of ['individual', 'admin', 'manager', '*', null]) await admin.post('/api/admin/notifications/broadcast').set(header).send({ ...input, audience }).expect(400);
  for (const link of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '/\\evil.example', '/login?token=secret', '/login?t%6fken=secret'])
    await admin.post('/api/admin/notifications/broadcast').set(header).send({ ...input, link }).expect(400);
  await admin.post('/api/admin/notifications/broadcast').set(header).send({ ...input, title: ' ' }).expect(400);
  await admin.post('/api/admin/notifications/broadcast').set(header).send({ ...input, message: 'x'.repeat(1001) }).expect(400);
  await assert.rejects(createNotification({ audience: 'individual', title: 'No recipient', message: 'Invalid' }));
});

test('incremental feed catches all new notifications in bounded pages and history pagination is stable across new arrivals', async () => {
  const first = await privateNotice(aliceId);
  const initial = (await alice.get('/api/notifications?limit=1').expect(200)).body;
  const second = await privateNotice(aliceId);
  const third = await privateNotice(aliceId);
  const next = (await alice.get(`/api/notifications?since=${initial.cursor}&limit=1`).expect(200)).body;
  assert.deepEqual(next.notifications.map((item: { _id: string }) => item._id), [String(second._id)]);
  assert.equal(next.hasMore, true);
  const tail = (await alice.get(`/api/notifications?since=${next.cursor}&limit=1`).expect(200)).body;
  assert.equal(tail.notifications[0]._id, String(third._id));
  assert.equal(tail.hasMore, false);
  assert.deepEqual((await alice.get(`/api/notifications?since=${tail.cursor}`).expect(200)).body.notifications, []);
  const older = (await alice.get(`/api/notifications?before=${second.sequence}&limit=1`).expect(200)).body;
  assert.equal(older.notifications[0]._id, String(first._id));
  assert.equal((await alice.get('/api/notifications?page=2&limit=1').expect(200)).body.notifications[0]._id, String(second._id));
  await alice.get('/api/notifications?limit=1000').expect(400);
  await alice.get('/api/notifications?since=invalid').expect(400);
  await alice.get('/api/notifications?since=0&before=10').expect(400);
});

test('polling synchronizes read/dismissed states and cannot inspect another user’s known IDs', async () => {
  const notice = await broadcast();
  const hidden = await privateNotice(bobId);
  const initial = (await alice.get('/api/notifications').expect(200)).body;
  await alice.patch(`/api/notifications/${notice._id}/read`).set(header).expect(200);
  const read = (await alice.get(`/api/notifications?since=${initial.cursor}&known=${notice._id},${hidden._id}`).expect(200)).body;
  assert.equal(read.states.length, 1);
  assert.equal(read.states[0].isRead, true);
  assert.ok(read.removedIds.includes(String(hidden._id)));
  await alice.delete(`/api/notifications/${notice._id}`).set(header).expect(200);
  const removed = (await alice.get(`/api/notifications?since=${initial.cursor}&known=${notice._id}`).expect(200)).body;
  assert.deepEqual(removed.states, []);
  assert.deepEqual(removed.removedIds, [String(notice._id)]);
});

test('notifications and receipts have 90-day TTL indexes; expired notices are inaccessible before TTL cleanup', async () => {
  const notice = await privateNotice(aliceId);
  assert.ok(Math.abs(notice.expiresAt.getTime() - notice.createdAt.getTime() - NOTIFICATION_RETENTION_MS) < 2000);
  await alice.patch(`/api/notifications/${notice._id}/read`).set(header).expect(200);
  const receipt = await NotificationReceipt.findOne({ notification: notice._id });
  assert.equal(receipt!.expiresAt.getTime(), notice.expiresAt.getTime());
  for (const model of [Notification, NotificationReceipt]) assert.ok((await model.collection.indexes()).some((index) => index.expireAfterSeconds === 0 && index.key.expiresAt === 1));
  await Notification.updateOne({ _id: notice._id }, { expiresAt: new Date(Date.now() - 1000) });
  assert.deepEqual((await alice.get('/api/notifications').expect(200)).body.notifications, []);
  await alice.patch(`/api/notifications/${notice._id}/read`).set(header).expect(404);
  assert.equal((await alice.get('/api/notifications/unread-count').expect(200)).body.unreadCount, 0);
});

test('transaction rollback leaves no notifications and concurrent creation commits unique ordered sequences', async () => {
  await assert.rejects(mongoose.connection.transaction(async (session) => {
    await createNotification({ audience: 'customers', title: 'Rolled back', message: 'Must never be visible' }, session);
    throw new Error('Rollback');
  }));
  assert.equal(await Notification.countDocuments(), 0);
  const created = await Promise.all(Array.from({ length: 4 }, () => privateNotice(aliceId)));
  assert.equal(new Set(created.map((notification) => notification.sequence)).size, 4);
});

test('orders generate only their customer and internal admin notifications, and idempotent retries do not duplicate events', async () => {
  const key = randomUUID();
  const input = { addressId, paymentMethod: 'cash', items: [{ productId, quantity: 1 }] };
  const placed = await alice.post('/api/orders').set(header).set('Idempotency-Key', key).send(input).expect(201);
  assert.equal((await alice.get('/api/notifications').expect(200)).body.notifications[0].title, 'Order received');
  assert.deepEqual((await bob.get('/api/notifications').expect(200)).body.notifications, []);
  const internal = (await admin.get('/api/admin/notifications').expect(200)).body.notifications[0];
  assert.equal(internal.title, 'New customer order');
  assert.match(internal.link, /\/admin\/orders\?q=/);
  await alice.post('/api/orders').set(header).set('Idempotency-Key', key).send(input).expect(200);
  assert.equal(await Notification.countDocuments(), 2);
  await admin.patch(`/api/admin/orders/${placed.body.order._id}/status`).set(header).send({ status: 'Confirmed' }).expect(200);
  assert.equal((await alice.get('/api/notifications').expect(200)).body.notifications[0].title, 'Order confirmed');
  const assigned = await admin.patch(`/api/admin/orders/${placed.body.order._id}/partner`).set(header).send({ partnerId }).expect(200);
  const deliveryNotice = (await partner.get('/api/delivery/notifications').expect(200)).body.notifications[0];
  assert.equal(deliveryNotice.title, 'Delivery assigned');
  assert.equal(deliveryNotice.link, `/delivery-partner/deliveries/${assigned.body.order.assignment}`);
});

test('delivery progress and collected cash notify only the order customer and relevant management accounts', async () => {
  const placed = await alice.post('/api/orders').set(header).send({ addressId, paymentMethod: 'cash', items: [{ productId, quantity: 1 }] }).expect(201);
  const orderId = placed.body.order._id;
  await admin.patch(`/api/admin/orders/${orderId}/status`).set(header).send({ status: 'Confirmed' }).expect(200);
  const assigned = await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId }).expect(200);
  const deliveryId = assigned.body.order.assignment;
  for (const status of ['Accepted', 'Picked Up', 'On The Way']) await partner.patch(`/api/delivery/deliveries/${deliveryId}/status`).set(header).send({ status }).expect(200);
  const order = (await alice.get(`/api/orders/${orderId}`).expect(200)).body.order;
  const before = await Notification.countDocuments();
  const wrongCode = order.deliveryOtp === '123456' ? '654321' : '123456';
  await partner.post(`/api/delivery/deliveries/${deliveryId}/deliver`).set(header).send({ otp: wrongCode }).expect(400);
  assert.equal(await Notification.countDocuments(), before, 'a failed delivery-code check creates no notification');
  await partner.post(`/api/delivery/deliveries/${deliveryId}/deliver`).set(header).send({ otp: order.deliveryOtp }).expect(200);
  const customer = (await alice.get('/api/notifications').expect(200)).body.notifications;
  assert.equal(customer[0].type, 'payment');
  assert.equal(customer[0].title, 'Payment received');
  assert.equal(customer[1].title, 'Order delivered');
  assert.equal((await admin.get('/api/admin/notifications').expect(200)).body.notifications[0].title, 'Order delivered');
  assert.deepEqual((await bob.get('/api/notifications').expect(200)).body.notifications, []);
});

test('public delivery applications notify only the internal admin account', async () => {
  await request(app).post('/api/delivery/application').set(header).send(application('new-notify-applicant@example.com')).expect(201);
  assert.equal((await admin.get('/api/admin/notifications').expect(200)).body.notifications[0].title, 'Delivery partner application');
  assert.deepEqual((await alice.get('/api/notifications').expect(200)).body.notifications, []);
  assert.deepEqual((await partner.get('/api/delivery/notifications').expect(200)).body.notifications, []);
});

test('refresh restores per-user notification state from MongoDB and logout prevents reusing the old cookie', async () => {
  const notice = await privateNotice(aliceId);
  await alice.patch(`/api/notifications/${notice._id}/read`).set(header).expect(200);
  assert.equal((await request(app).get('/api/notifications').set('Cookie', aliceCookie).expect(200)).body.notifications[0].isRead, true);
  await alice.post('/api/auth/logout').set(header).expect(200);
  await alice.get('/api/notifications').expect(401);
  await request(app).get('/api/notifications').set('Cookie', aliceCookie).expect(401);
  assert.deepEqual((await bob.get('/api/notifications').expect(200)).body.notifications, []);
  await alice.post('/api/auth/login').set(header).send({ email: 'alice-notify@example.com', password }).expect(200);
  assert.equal((await alice.get('/api/notifications').expect(200)).body.notifications[0].isRead, true);
});
