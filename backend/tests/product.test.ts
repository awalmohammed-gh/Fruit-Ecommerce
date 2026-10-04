import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { browser, cookie, cookieFrom } from './agent.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import User from '../models/User.js';
import Product, { discountFor } from '../models/Product.js';

const adminLogin = { email: 'owner@greenfarm.test', password: 'Static-admin-pass' };
const jwtSecret = randomBytes(48).toString('hex');
const app = createApp({ jwtSecret, authLimit: 1000, secureCookies: false, sameSite: 'lax', admin: adminLogin });
const admin = browser(app);
const shopper = browser(app);
const header = { 'X-GreenFarm-Request': 'true' };
const password = 'Test-password-123';
const cheese = {
  name: ' Cheese 200g ', description: 'Creamy and delicious, Perfect for pizzas and sandwiches, Rich in calcium',
  price: 130, originalPrice: 140, image: 'https://raw.githubusercontent.com/avinashdm/gs-images/main/greencart/gek3mmiig3lixlkpxks8.png',
  category: 'dairy-eggs', unit: '200g', stock: 100, isOrganic: false,
};
let database: MongoMemoryReplSet;
let cheeseId: string;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_products_test'));
  await admin.post('/api/auth/admin/login').set(header).send({ ...adminLogin, email: ' OWNER@greenfarm.test ' }).expect(200);
  await shopper.post('/api/auth/register').set(header).send({ fullName: 'Kofi Shopper', email: 'kofi@example.com', password }).expect(201);
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('admin signs in with the env credentials only and never touches the users collection', async () => {
  const me = await admin.get('/api/auth/admin/me').expect(200);
  assert.equal(me.body.admin.role, 'admin');
  assert.equal(me.body.admin.email, adminLogin.email);
  assert.equal(await User.countDocuments({ email: adminLogin.email }), 0);
  await request(app).post('/api/auth/register').set(header).send({ fullName: 'Imposter', email: adminLogin.email, password }).expect(409);
  // The admin session is not a customer session.
  assert.equal((await admin.get('/api/auth/me').expect(200)).body.user, null);
  await admin.get('/api/addresses').expect(401);

  // The customer sign-in never creates an admin session, even with the exact admin credentials.
  const viaCustomerForm = await request(app).post('/api/auth/login').set(header).send(adminLogin).expect(401);
  assert.equal(cookieFrom(viaCustomerForm, 'adminToken'), null);
  assert.equal(cookieFrom(viaCustomerForm, 'customerToken'), null);
  await request(app).post('/api/auth/login').set(header).send({ ...adminLogin, password: 'Wrong-admin-pass' }).expect(401);

  // The /admin sign-in screen only accepts the env admin, never a customer account.
  await request(app).post('/api/auth/admin/login').set(header).send({ email: 'kofi@example.com', password }).expect(401);
  await request(app).post('/api/auth/admin/login').set(header).send({ ...adminLogin, password: 'Wrong-admin-pass' }).expect(401);
  const viaAdminScreen = await request(app).post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  assert.equal(viaAdminScreen.body.admin.role, 'admin');
  assert.ok(cookieFrom(viaAdminScreen, 'adminToken'));
  assert.equal(cookieFrom(viaAdminScreen, 'customerToken'), null);

  // A customer session is refused by every admin endpoint, including when sent straight to the API.
  assert.equal((await shopper.get('/api/auth/admin/me').expect(200)).body.admin, null);
  await shopper.get('/api/admin/orders').expect(401);
  await shopper.post('/api/products').set(header).send({}).expect(401);
  await request(app).get('/api/admin/orders').expect(401);
  // A customer token sent in the admin cookie is still rejected (wrong account type).
  const shopperToken = cookieFrom(await request(app).post('/api/auth/login').set(header).send({ email: 'kofi@example.com', password }).expect(200), 'customerToken')!;
  await request(app).get('/api/admin/orders').set('Cookie', cookie('adminToken', shopperToken)).expect(401);

  // Signing out of one account type leaves the other signed in.
  const both = browser(app);
  await both.post('/api/auth/login').set(header).send({ email: 'kofi@example.com', password }).expect(200);
  await both.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  await both.post('/api/auth/logout').set(header).expect(200);
  assert.equal((await both.get('/api/auth/me').expect(200)).body.user, null);
  await both.get('/api/auth/admin/me').expect(200);
  await both.post('/api/auth/login').set(header).send({ email: 'kofi@example.com', password }).expect(200);
  await both.post('/api/auth/admin/logout').set(header).expect(200);
  assert.equal((await both.get('/api/auth/admin/me').expect(200)).body.admin, null);
  await both.get('/api/auth/me').expect(200);

  // A database role no longer grants admin rights.
  const kofi = await User.findOne({ email: 'kofi@example.com' });
  await User.updateOne({ _id: kofi!._id }, { role: 'admin' });
  await shopper.post('/api/products').set(header).send({}).expect(401);
  await User.updateOne({ _id: kofi!._id }, { role: 'user' });

  // Rotating ADMIN_PSD ends sessions signed with the old one.
  const adminToken = cookieFrom(await request(app).post('/api/auth/admin/login').set(header).send(adminLogin).expect(200), 'adminToken')!;
  const rotated = createApp({ jwtSecret, secureCookies: false, sameSite: 'lax', admin: { ...adminLogin, password: 'Rotated-admin-pass' } });
  await request(rotated).get('/api/auth/admin/me').set('Cookie', cookie('adminToken', adminToken)).expect(401);
  await request(rotated).post('/api/products').set(header).set('Cookie', cookie('adminToken', adminToken)).send({}).expect(401);
});

test('discount is derived from the two prices', () => {
  assert.equal(discountFor(130, 140), 7);
  assert.equal(discountFor(140, 140), 0);
  assert.equal(discountFor(150, 140), 0);
  assert.equal(discountFor(0, 20), 100);
});

test('admins create products; server owns discount, rating, review count and system fields', async () => {
  const response = await admin.post('/api/products').set(header)
    .send({ ...cheese, discount: 90, rating: 5, reviewCount: 999, _id: '69c22613ae75a98c7cd13b2e', createdAt: '2001-01-01T00:00:00.000Z', __v: 7 })
    .expect(201);
  const { product } = response.body;
  cheeseId = product._id;
  assert.notEqual(cheeseId, '69c22613ae75a98c7cd13b2e');
  assert.equal(product.name, 'Cheese 200g');
  assert.equal(product.discount, 7);
  assert.equal(product.rating, 0);
  assert.equal(product.reviewCount, 0);
  assert.equal(product.__v, undefined);
  assert.notEqual(product.createdAt, '2001-01-01T00:00:00.000Z');

  const plain = await admin.post('/api/products').set(header)
    .send({ name: 'Brown Bread', description: 'Baked this morning', price: '25.5', image: 'https://example.com/bread.png', category: 'Bakery', unit: '1 loaf' })
    .expect(201);
  assert.equal(plain.body.product.price, 25.5);
  assert.equal(plain.body.product.originalPrice, 25.5);
  assert.equal(plain.body.product.discount, 0);
  assert.equal(plain.body.product.stock, 0);
  assert.equal(plain.body.product.category, 'bakery');
});

test('product writes require an admin session', async () => {
  await request(app).post('/api/products').set(header).send(cheese).expect(401);
  await shopper.post('/api/products').set(header).send(cheese).expect(401);
  await shopper.patch(`/api/products/${cheeseId}`).set(header).send({ price: 1 }).expect(401);
  await shopper.delete(`/api/products/${cheeseId}`).set(header).expect(401);
});

test('invalid product input is rejected with 400', async () => {
  const bad = [
    { ...cheese, name: '' }, { ...cheese, image: '' }, { ...cheese, image: 'javascript:alert(1)' },
    { ...cheese, price: -1 }, { ...cheese, price: 'cheap' }, { ...cheese, originalPrice: 100 },
    { ...cheese, stock: -1 }, { ...cheese, stock: 2.5 }, { ...cheese, category: 'Dairy & Eggs' },
    { ...cheese, isOrganic: 'yes' }, { ...cheese, unit: undefined },
  ];
  for (const body of bad) await admin.post('/api/products').set(header).send(body).expect(400);
  assert.equal(await Product.countDocuments(), 2);
});

test('public catalogue filters, searches, sorts and paginates from MongoDB', async () => {
  await admin.post('/api/products').set(header).send({ ...cheese, name: 'Organic Spinach', description: 'Fresh leafy greens', category: 'vegetables', price: 12, originalPrice: 15, stock: 0, isOrganic: true }).expect(201);
  await Product.updateOne({ name: 'Organic Spinach' }, { rating: 4.8 });

  const all = await request(app).get('/api/products').expect(200);
  assert.equal(all.body.pagination.total, 3);
  assert.equal(all.body.products[0].name, 'Organic Spinach');
  assert.equal(all.body.products[0].__v, undefined);

  const search = await request(app).get('/api/products?q=CHEE').expect(200);
  assert.deepEqual(search.body.products.map((p: { name: string }) => p.name), ['Cheese 200g']);
  assert.equal((await request(app).get('/api/products?q=calcium').expect(200)).body.pagination.total, 1);
  assert.equal((await request(app).get('/api/products?q=.*').expect(200)).body.pagination.total, 0);

  assert.equal((await request(app).get('/api/products?category=dairy-eggs').expect(200)).body.products.length, 1);
  assert.equal((await request(app).get('/api/products?organic=true').expect(200)).body.products.length, 1);
  assert.equal((await request(app).get('/api/products?inStock=true').expect(200)).body.products.length, 1);
  assert.equal((await request(app).get('/api/products?minPrice=20&maxPrice=100').expect(200)).body.products.length, 1);
  await request(app).get('/api/products?minPrice=100&maxPrice=20').expect(400);

  const prices = (sort: string) => request(app).get(`/api/products?sort=${sort}`).then((r) => r.body.products.map((p: { price: number }) => p.price));
  assert.deepEqual(await prices('price_asc'), [12, 25.5, 130]);
  assert.deepEqual(await prices('price_desc'), [130, 25.5, 12]);
  assert.equal((await request(app).get('/api/products?sort=rating').expect(200)).body.products[0].name, 'Organic Spinach');

  const paged = await request(app).get('/api/products?sort=price_asc&limit=2&page=2').expect(200);
  assert.deepEqual(paged.body.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
  assert.equal(paged.body.products[0].price, 130);
  await request(app).get('/api/products?page=0').expect(400);
});

test('single product lookup by ID or readable slug', async () => {
  assert.equal((await request(app).get(`/api/products/${cheeseId}`).expect(200)).body.product.name, 'Cheese 200g');
  assert.equal((await request(app).get('/api/products/cheese-200g').expect(200)).body.product._id, cheeseId);
  // Anything that isn't an ID is looked up as a slug, so an unknown one is simply not found.
  await request(app).get('/api/products/not-an-id').expect(404);
  await request(app).get(`/api/products/${new mongoose.Types.ObjectId()}`).expect(404);
});

test('updates recalculate discount and ignore server-owned fields', async () => {
  const marked = await admin.patch(`/api/products/${cheeseId}`).set(header).send({ price: 105, discount: 0, rating: 5, reviewCount: 40 }).expect(200);
  assert.equal(marked.body.product.originalPrice, 140);
  assert.equal(marked.body.product.discount, 25);
  assert.equal(marked.body.product.rating, 0);
  assert.equal(marked.body.product.reviewCount, 0);

  await admin.patch(`/api/products/${cheeseId}`).set(header).send({ price: 150 }).expect(400);
  await admin.patch(`/api/products/${cheeseId}`).set(header).send({ stock: -1 }).expect(400);
  await admin.patch(`/api/products/${cheeseId}`).set(header).send({ stock: null }).expect(400);

  const ended = await admin.patch(`/api/products/${cheeseId}`).set(header).send({ originalPrice: null }).expect(200);
  assert.equal(ended.body.product.originalPrice, 105);
  assert.equal(ended.body.product.discount, 0);

  const repriced = await admin.patch(`/api/products/${cheeseId}`).set(header).send({ price: 120, stock: 0 }).expect(200);
  assert.equal(repriced.body.product.originalPrice, 120);
  assert.equal(repriced.body.product.stock, 0);
  assert.ok(await Product.exists({ _id: cheeseId }));
});

test('delete validates the ID and reports missing products', async () => {
  await admin.delete('/api/products/not-an-id').set(header).expect(400);
  await admin.delete(`/api/products/${cheeseId}`).set(header).expect(200);
  await admin.delete(`/api/products/${cheeseId}`).set(header).expect(404);
  await request(app).get(`/api/products/${cheeseId}`).expect(404);
});
