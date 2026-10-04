import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { browser } from './agent.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import User from '../models/User.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import { application, becomePartner, header, partnerPassword } from './partners.js';

const adminLogin = { email: 'manager@greenfarm.test', password: 'Static-admin-pass' };
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 1000, secureCookies: false, sameSite: 'lax', admin: adminLogin });
const admin = browser(app);
const customer = browser(app);
const applicant = browser(app);
const kwame = browser(app);
const esi = browser(app);
const password = 'Test-password-123';
let database: MongoMemoryReplSet;
let applicationId: string;
let reference: string;
let kwameId: string;
let esiId: string;
let addressId: string;
let product: string;
const kojo = application('kojo@example.com', 'Kojo Applicant');

const placeConfirmedOrder = async () => {
  const { order } = (await customer.post('/api/orders').set(header).send({ addressId, paymentMethod: 'cash', items: [{ productId: product, quantity: 1 }] }).expect(201)).body;
  await admin.patch(`/api/admin/orders/${order._id}/status`).set(header).send({ status: 'Confirmed' }).expect(200);
  return order._id as string;
};
const activeDeliveries = async (agent: typeof kwame) => (await agent.get('/api/delivery/deliveries').expect(200)).body.deliveries;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_delivery_test'));
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  product = (await admin.post('/api/products').set(header).send({ name: 'Plantain', description: 'Ripe', image: 'https://example.com/p.png', unit: 'bunch', category: 'fruits-vegetables', price: 30, stock: 50 }).expect(201)).body.product._id;
  await customer.post('/api/auth/register').set(header).send({ fullName: 'Abena Customer', email: 'abena@example.com', password }).expect(201);
  addressId = (await customer.post('/api/addresses').set(header).send({ label: 'Home', fullName: 'Abena Customer', phone: '0245556677', addressLine1: '3 Palm Lane', city: 'Tema', region: 'Greater Accra', digitalAddress: 'GT-001-0002' }).expect(201)).body.addresses[0]._id;
  kwameId = await becomePartner(admin, kwame, 'kwame@example.com', 'Kwame Rider');
  esiId = await becomePartner(admin, esi, 'esi@example.com', 'Esi Rider');
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('anyone can apply without a customer account, and the application always starts as Pending', async () => {
  const usersBefore = await User.countDocuments();
  const year = new Date().getUTCFullYear();
  await applicant.post('/api/delivery/application').set(header).send({ ...kojo, dateOfBirth: `${year - 16}-01-01` }).expect(400);
  await applicant.post('/api/delivery/application').set(header).send({ ...kojo, vehicleRegistration: '' }).expect(400);
  await applicant.post('/api/delivery/application').set(header).send({ ...kojo, email: 'not-an-email' }).expect(400);
  await applicant.post('/api/delivery/application').set(header).send({ ...kojo, emergencyContactPhone: kojo.phone }).expect(400);
  const submitted = (await applicant.post('/api/delivery/application').set(header)
    .send({ ...kojo, transportType: 'bicycle', vehicleType: '', vehicleRegistration: '', licenseNumber: '', applicationStatus: 'Approved', isActive: true, accountActivated: true, approvedBy: 'me', password: 'sneaky-pass-1' }).expect(201)).body;
  applicationId = submitted.application._id;
  reference = submitted.reference;
  assert.match(reference, /^GF-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(submitted.application.applicationStatus, 'Pending', 'applicants can never approve themselves');
  assert.equal(submitted.application.isActive, false);
  assert.equal(submitted.application.accountActivated, false);
  assert.equal(submitted.application.password, undefined);
  assert.equal(submitted.application.referenceHash, undefined);
  assert.equal(await User.countDocuments(), usersBefore, 'no customer User is created');
  const stored = await DeliveryPartner.findById(applicationId).select('+password +referenceHash');
  assert.equal(stored!.password, undefined, 'a password sent with the application is ignored');
  assert.notEqual(stored!.referenceHash, reference, 'only the reference hash is stored');
  assert.equal((stored as unknown as { user?: unknown }).user, undefined);

  // Duplicates: same email, or a phone already used by another live application.
  await applicant.post('/api/delivery/application').set(header).send(kojo).expect(409);
  await applicant.post('/api/delivery/application').set(header).send({ ...kojo, email: 'other@example.com' }).expect(409);
  // Someone with a customer account may also apply, with the same email; the two stay unlinked.
  await customer.post('/api/delivery/application').set(header).send(application('abena@example.com', 'Abena Customer')).expect(201);
  assert.equal((await customer.get('/api/delivery/me').expect(200)).body.partner, null);
  await customer.get('/api/delivery/summary').expect(401);
});

test('status checks and activation need the email and reference; login only works once approved and activated', async () => {
  await request(app).post('/api/delivery/application/status').set(header).send({ email: kojo.email, reference: 'GF-AAAA-BBBB' }).expect(404);
  await request(app).post('/api/delivery/application/status').set(header).send({ email: 'nobody@example.com', reference }).expect(404);
  assert.equal((await request(app).post('/api/delivery/application/status').set(header).send({ email: kojo.email, reference: reference.toLowerCase() }).expect(200)).body.application.applicationStatus, 'Pending');

  await applicant.post('/api/delivery/activate').set(header).send({ email: kojo.email, reference, password: partnerPassword }).expect(409);
  await applicant.post('/api/delivery/login').set(header).send({ email: kojo.email, password: partnerPassword }).expect(401);
  await applicant.get('/api/delivery/summary').expect(401);

  // A customer session never opens the partner dashboard, and a partner session never opens customer features.
  await customer.get('/api/delivery/deliveries').expect(401);
  await kwame.get('/api/orders').expect(401);
  await kwame.get('/api/addresses').expect(401);
  await kwame.get('/api/admin/delivery/applications').expect(401);
  await kwame.get('/api/delivery/me').expect(200);
});

test('only management reviews applications; approval leads to activation and login', async () => {
  await kwame.patch(`/api/admin/delivery/applications/${applicationId}/status`).set(header).send({ status: 'Approved' }).expect(401);
  await customer.patch(`/api/admin/delivery/applications/${applicationId}/status`).set(header).send({ status: 'Approved' }).expect(401);

  const list = (await admin.get('/api/admin/delivery/applications?status=Pending').expect(200)).body;
  assert.equal(list.counts.Pending, 2);
  assert.equal(list.counts.Approved, 2);
  assert.equal(list.applications[0].idNumber, undefined, 'lists only show summary fields');
  assert.equal((await admin.get('/api/admin/delivery/applications?q=kojo%40example').expect(200)).body.applications.length, 1);
  const detail = (await admin.get(`/api/admin/delivery/applications/${applicationId}`).expect(200)).body.application;
  assert.equal(detail.idNumber, kojo.idNumber);
  assert.equal(detail.password, undefined);
  assert.equal(detail.referenceHash, undefined);

  await admin.patch(`/api/admin/delivery/applications/${applicationId}/status`).set(header).send({ status: 'Suspended' }).expect(409);
  await admin.patch(`/api/admin/delivery/applications/${applicationId}/status`).set(header).send({ status: 'Rejected', reason: 'ID number could not be verified' }).expect(200);
  const rejected = (await request(app).post('/api/delivery/application/status').set(header).send({ email: kojo.email, reference }).expect(200)).body.application;
  assert.equal(rejected.rejectionReason, 'ID number could not be verified');
  await admin.patch(`/api/admin/delivery/applications/${applicationId}/status`).set(header).send({ status: 'Approved' }).expect(409);

  // A rejected applicant applies again with the same email: a new application with a new reference. The rejected
  // one is kept exactly as it was reviewed, so nobody who knows the email can rewrite it.
  const rejectedId = applicationId;
  const again = (await applicant.post('/api/delivery/application').set(header).send({ ...kojo, idNumber: 'GHA-999999999-9' }).expect(201)).body;
  assert.notEqual(again.application._id, rejectedId);
  const kept = await DeliveryPartner.findById(rejectedId);
  assert.equal(kept!.applicationStatus, 'Rejected');
  assert.equal(kept!.idNumber, kojo.idNumber.toUpperCase());
  assert.equal(kept!.replaced, true);
  assert.equal(String((await DeliveryPartner.findById(again.application._id))!.previousApplication), rejectedId);
  await request(app).post('/api/delivery/application/status').set(header).send({ email: kojo.email, reference }).expect(404);
  await admin.patch(`/api/admin/delivery/applications/${rejectedId}/status`).set(header).send({ status: 'Approved' }).expect(409);
  // Still one live application per email.
  await applicant.post('/api/delivery/application').set(header).send(kojo).expect(409);
  applicationId = again.application._id;
  reference = again.reference;

  const approved = (await admin.patch(`/api/admin/delivery/applications/${applicationId}/status`).set(header).send({ status: 'Approved' }).expect(200)).body.application;
  assert.equal(approved.isActive, false, 'not active until the applicant activates');
  await applicant.post('/api/delivery/login').set(header).send({ email: kojo.email, password: partnerPassword }).expect(401);

  // Lost code: management issues a new one.
  const issued = (await admin.post(`/api/admin/delivery/applications/${applicationId}/activation-code`).set(header).expect(200)).body.reference;
  await applicant.post('/api/delivery/activate').set(header).send({ email: kojo.email, reference, password: partnerPassword }).expect(404);
  await applicant.post('/api/delivery/activate').set(header).send({ email: kojo.email, reference: issued, password: 'short' }).expect(400);
  const activated = (await applicant.post('/api/delivery/activate').set(header).send({ email: kojo.email, reference: issued, password: partnerPassword }).expect(200)).body.partner;
  assert.equal(activated.accountActivated, true);
  assert.equal(activated.isActive, true);
  assert.equal(activated.password, undefined);
  assert.equal((await DeliveryPartner.findById(applicationId).select('+password'))!.password!.startsWith('$2'), true, 'password stored hashed');
  await applicant.post('/api/delivery/activate').set(header).send({ email: kojo.email, reference: issued, password: partnerPassword }).expect(409);
  await admin.post(`/api/admin/delivery/applications/${applicationId}/activation-code`).set(header).expect(409);

  await applicant.get('/api/delivery/summary').expect(200);
  await applicant.post('/api/delivery/logout').set(header).expect(200);
  await applicant.get('/api/delivery/summary').expect(401);
  await applicant.post('/api/delivery/login').set(header).send({ email: kojo.email, password: 'wrong-password' }).expect(401);
  await applicant.post('/api/delivery/login').set(header).send({ email: kojo.email, password: partnerPassword }).expect(200);
  assert.deepEqual((await applicant.get('/api/delivery/summary').expect(200)).body.summary, { assigned: 0, inProgress: 0, completed: 0, today: 0 });
  const history = (await admin.get(`/api/admin/delivery/applications/${applicationId}`).expect(200)).body.application.statusHistory;
  assert.deepEqual(history.map((entry: { status: string }) => entry.status), ['Pending', 'Approved', 'Approved']);
});

test('partners update safe profile fields only', async () => {
  const before = (await kwame.get('/api/delivery/profile').expect(200)).body.partner;
  await kwame.patch('/api/delivery/profile').set(header).send({ applicationStatus: 'Approved', isActive: true, fullName: 'Someone Else' }).expect(400);
  const { partner } = (await kwame.patch('/api/delivery/profile').set(header).send({ phone: '0551234567', city: 'Kasoa', region: 'Central', fullName: 'Someone Else' }).expect(200)).body;
  assert.equal(partner.phone, '0551234567');
  assert.equal(partner.city, 'Kasoa');
  assert.equal(partner.fullName, before.fullName);
  await kwame.patch('/api/delivery/profile').set(header).send({ region: 'Atlantis' }).expect(400);
});

test('assignment goes to activated partners only and reassignment keeps the trail', async () => {
  const orderId = await placeConfirmedOrder();
  const available = (await admin.get('/api/admin/delivery/partners?available=true').expect(200)).body.partners;
  assert.deepEqual(available.map((partner: { fullName: string }) => partner.fullName).sort(), ['Esi Rider', 'Kojo Applicant', 'Kwame Rider']);
  // Abena's application is still pending, so she can't be assigned.
  const abena = (await admin.get('/api/admin/delivery/applications?q=abena').expect(200)).body.applications[0];
  await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: abena._id }).expect(400);

  await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: kwameId }).expect(200);
  const first = (await activeDeliveries(kwame))[0];
  assert.equal(first.order.address.digitalAddress, 'GT-001-0002');
  assert.equal((await activeDeliveries(esi)).length, 0, 'partners only see their own deliveries');
  await esi.patch(`/api/delivery/deliveries/${first._id}/status`).set(header).send({ status: 'Accepted' }).expect(404);
  await esi.get(`/api/delivery/deliveries/${first._id}`).expect(404);
  const ownDelivery = (await kwame.get(`/api/delivery/deliveries/${first._id}`).expect(200)).body.delivery;
  assert.equal(ownDelivery.order.recipient.name, 'Abena Customer');
  assert.equal(JSON.stringify(ownDelivery).includes('abena@example.com'), false);
  await kwame.patch(`/api/delivery/deliveries/${first._id}/status`).set(header).send({ status: 'Accepted' }).expect(200);

  const reassigned = (await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: esiId, notes: 'Kwame is off sick' }).expect(200)).body.order;
  assert.deepEqual(reassigned.assignments.map((entry: { status: string }) => entry.status), ['Reassigned', 'Assigned']);
  assert.equal((await activeDeliveries(kwame)).length, 0);
  await kwame.patch(`/api/delivery/deliveries/${first._id}/status`).set(header).send({ status: 'Picked Up' }).expect(409);

  const second = (await activeDeliveries(esi))[0];
  assert.equal(second.notes, 'Kwame is off sick');
  await esi.post(`/api/delivery/deliveries/${second._id}/decline`).set(header).send({ reason: 'Too far today' }).expect(200);
  const declined = (await admin.get(`/api/admin/orders/${orderId}`).expect(200)).body.order;
  assert.equal(declined.status, 'Packed');
  assert.equal(declined.deliveryStatus, 'Declined');

  await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: kwameId }).expect(200);
  const third = (await activeDeliveries(kwame))[0];
  await kwame.patch(`/api/delivery/deliveries/${third._id}/status`).set(header).send({ status: 'Accepted' }).expect(200);
  await kwame.patch(`/api/delivery/deliveries/${third._id}/status`).set(header).send({ status: 'Picked Up' }).expect(200);
  await kwame.post(`/api/delivery/deliveries/${third._id}/fail`).set(header).send({ reason: 'Other' }).expect(400);
  const failed = (await kwame.post(`/api/delivery/deliveries/${third._id}/fail`).set(header).send({ reason: 'Customer unreachable', note: 'Called three times' }).expect(200)).body.delivery;
  assert.deepEqual(failed.history.map((entry: { status: string }) => entry.status), ['Assigned', 'Accepted', 'Picked Up', 'Failed Delivery']);
  assert.equal((await customer.get(`/api/orders/${orderId}`).expect(200)).body.order.status, 'Packed');

  const tracking = (await admin.get('/api/admin/delivery/assignments').expect(200)).body;
  assert.equal(tracking.counts.failed, 2);
  assert.equal(tracking.counts.closed, 1);
  const detail = (await admin.get(`/api/admin/delivery/assignments/${third._id}`).expect(200)).body;
  assert.equal(detail.attempts.length, 3);
  assert.equal((await kwame.get('/api/delivery/deliveries?view=history&status=Failed%20Delivery').expect(200)).body.deliveries.length, 1);
});

test('suspension signs the partner out at once and removes them from assignment', async () => {
  const orderId = await placeConfirmedOrder();
  await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: esiId }).expect(200);
  const suspended = (await admin.patch(`/api/admin/delivery/applications/${esiId}/status`).set(header).send({ status: 'Suspended', reason: 'Late deliveries' }).expect(200)).body;
  assert.equal(suspended.openDeliveries, 1);
  assert.equal(suspended.application.isActive, false);
  await esi.get('/api/delivery/deliveries').expect(401);
  const blocked = await esi.post('/api/delivery/login').set(header).send({ email: 'esi@example.com', password: partnerPassword }).expect(403);
  assert.match(blocked.body.message, /suspended/);
  assert.equal((await admin.get('/api/admin/delivery/partners?available=true').expect(200)).body.partners.some((partner: { _id: string }) => partner._id === esiId), false);
  await admin.patch(`/api/admin/orders/${await placeConfirmedOrder()}/partner`).set(header).send({ partnerId: esiId }).expect(400);
  await admin.patch(`/api/admin/orders/${orderId}/partner`).set(header).send({ partnerId: kwameId }).expect(200);

  const reactivated = (await admin.patch(`/api/admin/delivery/applications/${esiId}/status`).set(header).send({ status: 'Approved' }).expect(200)).body.application;
  assert.equal(reactivated.isActive, true, 'reactivating restores an account that was already activated');
  await esi.post('/api/delivery/login').set(header).send({ email: 'esi@example.com', password: partnerPassword }).expect(200);
  await esi.get('/api/delivery/deliveries').expect(200);
});
