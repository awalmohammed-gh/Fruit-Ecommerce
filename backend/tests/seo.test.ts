import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { browser } from './agent.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { addProductSlugs, connectDatabase } from '../config/database.js';
import Product from '../models/Product.js';

const adminLogin = { email: 'owner@greenfarm.test', password: 'Static-admin-pass' };
const siteUrl = 'https://greenfarm.test';
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'greenfarm-dist-'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><meta charset="UTF-8" />\n<!--seo--><title>GreenFarm</title><!--/seo-->\n</head><body><div id="root"></div></body></html>');
const base = { jwtSecret: randomBytes(48).toString('hex'), authLimit: 1000, secureCookies: false, sameSite: 'lax' as const, admin: adminLogin, siteUrl };
const app = createApp(base);
const hosted = createApp({ ...base, storefrontDist: dist });
const admin = browser(app);
const header = { 'X-GreenFarm-Request': 'true' };
const image = 'https://raw.githubusercontent.com/avinashdm/gs-images/main/greencart/gek3mmiig3lixlkpxks8.png';
const cheese = { name: 'Cheese 200g', description: 'Creamy and delicious.   Perfect for pizzas and sandwiches, rich in calcium.', price: 130, image, category: 'dairy-eggs', unit: '200g', stock: 5 };
let database: MongoMemoryReplSet;
let cheeseId: string;

const meta = async (pagePath: string) => (await request(app).get('/api/seo').query({ path: pagePath }).expect(200)).body;
const tag = (body: { tags: { tag: string; attributes: Record<string, string> }[] }, key: string) =>
  body.tags.find(({ attributes }) => attributes.name === key || attributes.property === key || attributes.rel === key)?.attributes;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
  await connectDatabase(database.getUri('greenfarm_seo_test'));
  await admin.post('/api/auth/admin/login').set(header).send(adminLogin).expect(200);
  await admin.post('/api/categories').set(header).send({ name: 'Dairy & Eggs', description: 'Fresh milk, cheese, yoghurt and eggs.', image: 'https://example.com/dairy.png' }).expect(201);
  await admin.post('/api/categories').set(header).send({ name: 'Snacks', isActive: false }).expect(201);
  cheeseId = (await admin.post('/api/products').set(header).send(cheese).expect(201)).body.product._id;
});
after(async () => { await mongoose.disconnect(); await database?.stop(); fs.rmSync(dist, { recursive: true, force: true }); });

test('products get readable, unique, stable slugs and open by slug or ID', async () => {
  const twin = (await admin.post('/api/products').set(header).send(cheese).expect(201)).body.product;
  assert.equal(twin.slug, 'cheese-200g-2');
  const bySlug = (await request(app).get('/api/products/cheese-200g').expect(200)).body.product;
  assert.equal(bySlug._id, cheeseId);
  assert.equal((await request(app).get(`/api/products/${cheeseId}`).expect(200)).body.product.slug, 'cheese-200g');
  await request(app).get('/api/products/no-such-product').expect(404);
  // Renaming keeps the address, so shared links keep working.
  await admin.patch(`/api/products/${twin._id}`).set(header).send({ name: 'Cheddar 200g' }).expect(200);
  assert.equal((await request(app).get(`/api/products/${twin._id}`).expect(200)).body.product.slug, 'cheese-200g-2');
  await admin.delete(`/api/products/${twin._id}`).set(header).expect(200);
  // Products saved before slugs existed get one once.
  await Product.collection.insertOne({ name: 'Brown Bread 400g', description: 'Soft', price: 20, originalPrice: 20, image, category: 'bakery', unit: '400g', stock: 1, isOrganic: false, rating: 0, reviewCount: 0, discount: 0 });
  await addProductSlugs();
  assert.equal((await Product.findOne({ name: 'Brown Bread 400g' }))!.slug, 'brown-bread-400g');
  // Its category has no public page, so the breadcrumb goes through the shop rather than to a missing page.
  const bread = (await request(app).get('/api/seo').query({ path: '/products/brown-bread-400g' }).expect(200)).body;
  assert.deepEqual(bread.jsonLd[1].itemListElement.map((item: { item: string }) => item.item), [`${siteUrl}/`, `${siteUrl}/products`, `${siteUrl}/products/brown-bread-400g`]);
});

test('product pages: unique title, cleaned description, canonical slug URL, sharing tags and Product data', async () => {
  const page = await meta('/products/cheese-200g');
  assert.equal(page.status, 200);
  assert.equal(page.title, 'Cheese 200g | GreenFarm');
  assert.equal(tag(page, 'description')!.content, 'Creamy and delicious. Perfect for pizzas and sandwiches, rich in calcium.');
  assert.equal(tag(page, 'canonical')!.href, `${siteUrl}/products/cheese-200g`);
  assert.equal(tag(page, 'robots')!.content, 'index,follow');
  assert.equal(tag(page, 'og:type')!.content, 'product');
  assert.equal(tag(page, 'og:image')!.content, image);
  assert.equal(tag(page, 'og:image:alt')!.content, 'Cheese 200g product image');
  assert.equal(tag(page, 'twitter:card')!.content, 'summary_large_image');
  assert.equal(tag(page, 'product:price:currency')!.content, 'GHS');
  const product = page.jsonLd.find((item: { '@type': string }) => item['@type'] === 'Product');
  assert.equal(product.offers.priceCurrency, 'GHS');
  assert.equal(product.offers.price, '130.00');
  assert.equal(product.offers.availability, 'https://schema.org/InStock');
  assert.equal(product.aggregateRating, undefined, 'no rating without real reviews');
  const crumbs = page.jsonLd.find((item: { '@type': string }) => item['@type'] === 'BreadcrumbList');
  assert.deepEqual(crumbs.itemListElement.map((item: { name: string }) => item.name), ['Home', 'Dairy & Eggs', 'Cheese 200g']);

  // The old ID address points search engines at the slug address.
  assert.equal(tag(await meta(`/products/${cheeseId}`), 'canonical')!.href, `${siteUrl}/products/cheese-200g`);
  // Admin overrides win; real ratings are included.
  await admin.patch(`/api/products/${cheeseId}`).set(header).send({ seoTitle: 'Buy Cheese 200g online | GreenFarm', seoDescription: 'Cheese for pizza night.', stock: 0 }).expect(200);
  await Product.updateOne({ _id: cheeseId }, { rating: 4.5, reviewCount: 2 });
  const edited = await meta('/products/cheese-200g');
  assert.equal(edited.title, 'Buy Cheese 200g online | GreenFarm');
  assert.equal(tag(edited, 'og:description')!.content, 'Cheese for pizza night.');
  const offer = edited.jsonLd[0];
  assert.equal(offer.offers.availability, 'https://schema.org/OutOfStock');
  assert.deepEqual({ value: offer.aggregateRating.ratingValue, count: offer.aggregateRating.reviewCount }, { value: 4.5, count: 2 });
  await admin.patch(`/api/products/${cheeseId}`).set(header).send({ seoTitle: 'x'.repeat(71) }).expect(400);

  const missing = await meta('/products/does-not-exist');
  assert.equal(missing.status, 404);
  assert.equal(tag(missing, 'robots')!.content, 'noindex,nofollow');
  assert.equal(tag(missing, 'canonical'), undefined);
});

test('category pages: title, description, image, canonical rules and collection data', async () => {
  const page = await meta('/category/dairy-eggs');
  assert.equal(page.title, 'Dairy & Eggs | GreenFarm');
  assert.equal(tag(page, 'description')!.content, 'Fresh milk, cheese, yoghurt and eggs.');
  assert.equal(tag(page, 'og:image')!.content, 'https://example.com/dairy.png');
  assert.equal(tag(page, 'canonical')!.href, `${siteUrl}/category/dairy-eggs`);
  const collection = page.jsonLd.find((item: { '@type': string }) => item['@type'] === 'CollectionPage');
  assert.equal(collection.mainEntity.itemListElement[0].url, `${siteUrl}/products/cheese-200g`);
  const crumbs = page.jsonLd.find((item: { '@type': string }) => item['@type'] === 'BreadcrumbList');
  assert.deepEqual(crumbs.itemListElement.map((item: { name: string }) => item.name), ['Home', 'Shop', 'Dairy & Eggs']);

  // Filters and sorting don't create new indexable pages; page 2 is its own page.
  const sorted = await meta('/category/dairy-eggs?sort=price_asc&organic=true');
  assert.equal(tag(sorted, 'robots')!.content, 'noindex,follow');
  assert.equal(tag(sorted, 'canonical')!.href, `${siteUrl}/category/dairy-eggs`);
  assert.equal(tag(await meta('/category/dairy-eggs?page=2'), 'canonical')!.href, `${siteUrl}/category/dairy-eggs?page=2`);
  // The old filter address is a duplicate of the category page.
  const legacy = await meta('/products?category=dairy-eggs');
  assert.equal(tag(legacy, 'canonical')!.href, `${siteUrl}/category/dairy-eggs`);
  assert.equal(tag(legacy, 'robots')!.content, 'noindex,follow');
  // Disabled or unknown categories don't exist publicly.
  assert.equal((await meta('/category/snacks')).status, 404);
  assert.equal((await meta('/category/nothing-here')).status, 404);
});

test('homepage, listing, deals, search, private areas and unknown pages', async () => {
  const home = await meta('/');
  assert.equal(home.title, 'GreenFarm | Fresh Groceries Delivered in Accra');
  assert.equal(tag(home, 'canonical')!.href, `${siteUrl}/`);
  assert.equal(tag(home, 'og:image')!.content, `${siteUrl}/content/hero-banner.jpg`);
  assert.deepEqual(home.jsonLd.map((item: { '@type': string }) => item['@type']), ['Organization', 'WebSite']);
  assert.equal(home.jsonLd[1].potentialAction.target.urlTemplate, `${siteUrl}/search?q={search_term_string}`);

  // The admin's defaults drive every page.
  const { content } = (await admin.get('/api/admin/content').expect(200)).body;
  await admin.put('/api/admin/content/seo').set(header).send({ ...content.seo, siteName: 'Green Farm GH', defaultTitle: 'Green Farm GH | Groceries in Accra' }).expect(200);
  await admin.put('/api/admin/content/seo').set(header).send({ ...content.seo, siteName: '' }).expect(400);
  assert.equal((await meta('/')).title, 'Green Farm GH | Groceries in Accra');
  assert.equal((await meta('/deals')).title, 'Deals and discounts | Green Farm GH');
  await admin.put('/api/admin/content/seo').set(header).send(content.seo).expect(200);

  const listing = await meta('/products');
  assert.equal(listing.title, 'Shop all groceries | GreenFarm');
  assert.match(tag(listing, 'description')?.content ?? '', /Dairy & Eggs/);
  assert.equal(tag(await meta('/products?sort=price_asc'), 'robots')!.content, 'noindex,follow');
  assert.equal(tag(await meta('/search?q=milk'), 'robots')!.content, 'noindex,follow');
  assert.equal(tag(await meta('/delivery-partner/apply'), 'robots')!.content, 'index,follow');

  for (const privatePath of ['/login', '/cart', '/checkout', '/account', '/my-orders/abc', '/my-address', '/admin', '/admin/settings', '/delivery-partner/dashboard', '/delivery-partner/login', '/delivery-partner/status']) {
    const page = await meta(privatePath);
    assert.equal(tag(page, 'robots')!.content, 'noindex,nofollow', privatePath);
    assert.equal(tag(page, 'canonical'), undefined, privatePath);
  }
  assert.equal((await meta('/no/such/page')).status, 404);
  await request(app).get('/api/seo').query({ path: 'https://evil.example/' }).expect(400);
  // API data is never shown in search results.
  assert.equal((await request(app).get('/api/products').expect(200)).headers['x-robots-tag'], 'noindex');
});

test('sitemap lists only public, existing content; robots.txt points to it', async () => {
  const xml = (await request(app).get('/sitemap.xml').expect(200).expect('Content-Type', /xml/)).text;
  for (const url of ['/', '/products', '/deals', '/category/dairy-eggs', '/products/cheese-200g', '/products/brown-bread-400g'])
    assert.ok(xml.includes(`<loc>${siteUrl}${url}</loc>`), url);
  for (const hidden of ['/category/snacks', '/admin', '/cart', '/checkout', '/account', '/login', '/delivery-partner/dashboard'])
    assert.ok(!xml.includes(`${siteUrl}${hidden}<`), hidden);
  assert.ok(xml.includes(`<image:loc>${image}</image:loc>`));
  // Deleted products drop out straight away.
  await admin.delete(`/api/products/${(await Product.findOne({ slug: 'brown-bread-400g' }))!._id}`).set(header).expect(200);
  assert.ok(!(await request(app).get('/sitemap.xml').expect(200)).text.includes('brown-bread-400g'));

  const robots = (await request(app).get('/robots.txt').expect(200).expect('Content-Type', /text\/plain/)).text;
  for (const line of ['Disallow: /admin', 'Disallow: /account', 'Disallow: /checkout', 'Disallow: /cart', 'Disallow: /delivery-partner/', 'Allow: /delivery-partner/apply', `Sitemap: ${siteUrl}/sitemap.xml`])
    assert.ok(robots.includes(line), line);
});

test('server-hosted storefront: metadata in the HTML, real 404s, private pages marked noindex', async () => {
  await admin.patch(`/api/products/${cheeseId}`).set(header).send({ seoTitle: '', name: 'Cheese </script><script>alert(1)</script>' }).expect(200);
  const product = await request(hosted).get('/products/cheese-200g').expect(200).expect('Content-Type', /html/);
  assert.match(product.text, /<title>Cheese &lt;\/script&gt;/);
  assert.match(product.text, /<link data-seo rel="canonical" href="https:\/\/greenfarm.test\/products\/cheese-200g">/);
  assert.match(product.text, /<meta data-seo property="og:type" content="product">/);
  // Admin-entered text can't close the structured-data script.
  assert.ok(!product.text.includes('</script><script>alert(1)'));
  assert.match(product.text, /\\u003c\/script>/);
  assert.ok(product.text.includes('<div id="root"></div>'));

  await request(hosted).get('/products/gone').expect(404).expect('Content-Type', /html/);
  await request(hosted).get('/category/snacks').expect(404);
  await request(hosted).get('/totally/unknown').expect(404);
  const adminPage = await request(hosted).get('/admin/settings').expect(200);
  assert.equal(adminPage.headers['x-robots-tag'], 'noindex,nofollow');
  // The API keeps working next to the storefront.
  await request(hosted).get('/api/products').expect(200).expect('Content-Type', /json/);
  await request(hosted).get('/api/nope').expect(404).expect('Content-Type', /json/);
});
