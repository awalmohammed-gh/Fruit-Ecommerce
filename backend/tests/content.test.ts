import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { browser } from './agent.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';
import Banner from '../models/Banner.js';

const adminLogin = { email: 'owner@greenfarm.test', password: 'Static-admin-pass' };
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), authLimit: 1000, secureCookies: false, sameSite: 'lax', admin: adminLogin });
const admin = browser(app);
const shopper = browser(app);
const header = { 'X-GreenFarm-Request': 'true' };
const visitor = () => request(app).get('/api/content').expect(200).then((response) => response.body);
let database: MongoMemoryReplSet;

const slide = (heading: string, extra = {}) => ({
  image: 'https://res.cloudinary.com/demo/image/upload/hero.jpg', label: 'Fresh', heading, highlight: '', description: `${heading} description`,
  primaryText: 'Shop now', primaryLink: '/products', secondaryText: '', secondaryLink: '', active: true, ...extra,
});

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_content_test'));
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  await shopper.post('/api/auth/register').set(header).send({ fullName: 'Kofi Shopper', email: 'kofi@example.com', password: 'Test-password-123' }).expect(201);
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('a fresh store shows the original home page content and starting banner', async () => {
  const site = await visitor();
  assert.equal(site.hero.slides.length, 1);
  assert.equal(site.hero.slides[0].heading, 'Fresh Produce,');
  assert.equal(site.hero.slides[0].image, '/content/hero-banner.jpg');
  assert.equal(site.announcement.message, 'Fresh groceries delivered across Accra');
  assert.equal(site.sections.features.length, 4);
  assert.equal(site.ads.partner.ctaLink, '/delivery-partner/apply');
  assert.deepEqual(site.banners.map((banner: { placement: string }) => banner.placement), ['home-middle']);
  // Admin-only fields stay private.
  assert.equal(site.banners[0].name, undefined);
  assert.equal(site.store.email, 'info@greenfarm.com');
});

test('only the admin can read or change settings content', async () => {
  await request(app).get('/api/admin/content').expect(401);
  await shopper.get('/api/admin/content').expect(401);
  await shopper.put('/api/admin/content/hero').set(header).send({}).expect(401);
  await shopper.post('/api/admin/banners').set(header).send({}).expect(401);
  await admin.put('/api/admin/content/everything').set(header).send({}).expect(404);
});

test('single hero: edits show on the storefront; an inactive hero is hidden', async () => {
  const { content } = (await admin.get('/api/admin/content').expect(200)).body;
  const single = { ...content.hero.single, heading: 'Fresh groceries delivered to your doorstep', image: 'https://res.cloudinary.com/demo/image/upload/new.jpg' };
  const saved = await admin.put('/api/admin/content/hero').set(header).send({ ...content.hero, single }).expect(200);
  assert.equal(saved.body.message, 'Hero section updated successfully');
  let site = await visitor();
  assert.equal(site.hero.slides[0].heading, 'Fresh groceries delivered to your doorstep');
  assert.equal(site.hero.slides[0].image, 'https://res.cloudinary.com/demo/image/upload/new.jpg');

  await admin.put('/api/admin/content/hero').set(header).send({ ...content.hero, single: { ...single, active: false } }).expect(200);
  site = await visitor();
  assert.deepEqual(site.hero.slides, []);
});

test('hero slider: independent slides, admin order, inactive slides hidden', async () => {
  const { content } = (await admin.get('/api/admin/content').expect(200)).body;
  const slides = [
    slide('Save more on fresh dairy', { primaryLink: '/products?category=dairy-eggs' }),
    slide('Hidden for now', { active: false, image: '' }),
    slide('Organic products for your family', { secondaryText: 'See deals', secondaryLink: '/deals' }),
  ];
  await admin.put('/api/admin/content/hero').set(header).send({ ...content.hero, mode: 'slider', autoplaySeconds: 5, slides }).expect(200);
  const site = await visitor();
  assert.equal(site.hero.autoplaySeconds, 5);
  assert.deepEqual(site.hero.slides.map((entry: { heading: string }) => entry.heading), ['Save more on fresh dairy', 'Organic products for your family']);
  assert.equal(site.hero.slides[0].primaryLink, '/products?category=dairy-eggs');
  assert.equal(site.hero.slides[1].secondaryLink, '/deals');

  // Reordering is the order of the list.
  await admin.put('/api/admin/content/hero').set(header).send({ ...content.hero, mode: 'slider', slides: [slides[2], slides[0]] }).expect(200);
  assert.deepEqual((await visitor()).hero.slides.map((entry: { heading: string }) => entry.heading), ['Organic products for your family', 'Save more on fresh dairy']);
  // The single hero is kept while the slider is in use.
  const after = (await admin.get('/api/admin/content').expect(200)).body.content;
  assert.equal(after.hero.single.heading, 'Fresh groceries delivered to your doorstep');
});

test('hero input is validated', async () => {
  const { content } = (await admin.get('/api/admin/content').expect(200)).body;
  const send = (hero: object) => admin.put('/api/admin/content/hero').set(header).send({ ...content.hero, ...hero });
  const bad = async (hero: object, message: RegExp) => assert.match((await send(hero).expect(400)).body.message, message);
  await bad({ mode: 'carousel' }, /Single hero or Hero slider/);
  await bad({ slides: [slide('Danger', { primaryLink: 'javascript:alert(1)' })] }, /link must be a page on this site/);
  await bad({ slides: [slide('Off-site image', { image: 'http://example.com/a.jpg' })] }, /HTTPS image URL/);
  await bad({ slides: [slide('No picture', { image: '' })] }, /needs an image/);
  await bad({ slides: [slide('Half a button', { primaryLink: '' })] }, /needs both its text and its link/);
  await bad({ slides: Array.from({ length: 7 }, (_, index) => slide(`Slide ${index}`)) }, /at most 6 slides/);
  await bad({ autoplaySeconds: 99 }, /between 0/);
  // Web addresses and page sections are fine as links.
  await send({ slides: [slide('External', { primaryLink: 'https://example.com/promo', secondaryText: 'Browse', secondaryLink: '#categories' })] }).expect(200);
});

test('announcement, homepage text, store details and ads save and publish', async () => {
  await admin.put('/api/admin/content/announcement').set(header).send({ active: true, message: '' }).expect(400);
  await admin.put('/api/admin/content/announcement').set(header).send({ active: false, message: 'Back soon', secondary: '' }).expect(200);
  assert.equal((await visitor()).announcement, null);

  const { content } = (await admin.get('/api/admin/content').expect(200)).body;
  await admin.put('/api/admin/content/sections').set(header).send({ ...content.sections, features: content.sections.features.slice(1) }).expect(400);
  await admin.put('/api/admin/content/sections').set(header).send({ ...content.sections, popular: { eyebrow: '', heading: 'This week\'s favourites', description: '' } }).expect(200);
  await admin.put('/api/admin/content/store').set(header).send({ description: 'Fresh food', address: 'Osu, Accra', phone: '030 000 0000', email: 'Help@GreenFarm.com' }).expect(200);
  await admin.put('/api/admin/content/store').set(header).send({ email: 'not-an-email' }).expect(400);
  await admin.put('/api/admin/content/ads').set(header).send({ ...content.ads, newsletter: { ...content.ads.newsletter, active: false } }).expect(200);
  await admin.put('/api/admin/content/ads').set(header).send({ ...content.ads, partner: { ...content.ads.partner, points: ['a', 'b', 'c', 'd', 'e'] } }).expect(400);

  const site = await visitor();
  assert.equal(site.sections.popular.heading, 'This week\'s favourites');
  assert.equal(site.store.email, 'help@greenfarm.com');
  assert.equal(site.ads.newsletter, null);
  assert.equal(site.ads.partner.title, 'Deliver with Green Farm');
});

test('banners: inactive drafts, schedules, edit, toggle and delete', async () => {
  const draft = { name: 'Dairy week', placement: 'home-top', title: 'Dairy week', description: 'Save on milk', image: 'https://res.cloudinary.com/demo/image/upload/milk.png', buttonText: 'Shop dairy', buttonLink: '/products?category=dairy-eggs' };
  await admin.post('/api/admin/banners').set(header).send({ ...draft, placement: 'sidebar' }).expect(400);
  await admin.post('/api/admin/banners').set(header).send({ ...draft, buttonLink: '' }).expect(400);
  await admin.post('/api/admin/banners').set(header).send({ ...draft, startsAt: '2030-02-01', endsAt: '2030-01-01' }).expect(400);

  const created = (await admin.post('/api/admin/banners').set(header).send(draft).expect(201)).body.banner;
  assert.equal(created.active, false, 'new banners start inactive');
  const live = async () => (await visitor()).banners.map((banner: { title: string }) => banner.title);
  assert.ok(!(await live()).includes('Dairy week'));

  await admin.patch(`/api/admin/banners/${created._id}/status`).set(header).send({ active: true }).expect(200);
  assert.ok((await live()).includes('Dairy week'));

  // Scheduled for the future, or already ended: not shown.
  await admin.put(`/api/admin/banners/${created._id}`).set(header).send({ ...draft, active: true, startsAt: new Date(Date.now() + 86400000).toISOString() }).expect(200);
  assert.ok(!(await live()).includes('Dairy week'));
  await admin.put(`/api/admin/banners/${created._id}`).set(header).send({ ...draft, active: true, endsAt: new Date(Date.now() - 1000).toISOString() }).expect(200);
  assert.ok(!(await live()).includes('Dairy week'));
  await admin.put(`/api/admin/banners/${created._id}`).set(header).send({ ...draft, title: 'Dairy fortnight', active: true, startsAt: new Date(Date.now() - 1000).toISOString() }).expect(200);
  assert.ok((await live()).includes('Dairy fortnight'));

  // Category banners keep their category; other placements drop it.
  const category = (await admin.post('/api/admin/banners').set(header).send({ ...draft, placement: 'category', category: 'dairy-eggs', active: true }).expect(201)).body.banner;
  assert.equal(category.category, 'dairy-eggs');
  const top = (await admin.post('/api/admin/banners').set(header).send({ ...draft, category: 'dairy-eggs' }).expect(201)).body.banner;
  assert.equal(top.category, '');

  const list = (await admin.get('/api/admin/banners').expect(200)).body.banners;
  assert.equal(list.length, 4);
  for (const banner of list) await admin.delete(`/api/admin/banners/${banner._id}`).set(header).expect(200);
  await admin.delete(`/api/admin/banners/${created._id}`).set(header).expect(404);
  // Deleting every banner does not bring the starting one back.
  assert.deepEqual((await visitor()).banners, []);
  assert.equal(await Banner.countDocuments(), 0);
});
