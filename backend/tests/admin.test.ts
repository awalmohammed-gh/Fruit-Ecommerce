import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { browser } from "./agent.js";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../app.js";
import { connectDatabase } from "../config/database.js";
import { slugify } from "../models/Category.js";
import { Writable } from "node:stream";
import cloudinary from "../config/cloudinary.js";

const adminLogin = {
  email: "owner@greenfarm.test",
  password: "Static-admin-pass",
};
const app = createApp({
  jwtSecret: randomBytes(48).toString("hex"),
  authLimit: 1000,
  secureCookies: false,
  sameSite: "lax",
  admin: adminLogin,
});
const admin = browser(app);
const shopper = browser(app);
const header = { "X-GreenFarm-Request": "true" };
const password = "Test-password-123";
const base = {
  description: "Fresh from the farm",
  image: "https://example.com/item.png",
  unit: "1kg",
  isOrganic: false,
};
let database: MongoMemoryReplSet;
let shopperId: string;

before(async () => {
  database = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.16" },
  });
  await connectDatabase(database.getUri("greenfarm_admin_test"));
  await admin
    .post("/api/auth/admin/login")
    .set(header)
    .send(adminLogin)
    .expect(200);
  shopperId = (
    await shopper
      .post("/api/auth/register")
      .set(header)
      .send({
        fullName: "Esi Mensah",
        email: "esi@example.com",
        phone: "0241234567",
        password,
      })
      .expect(201)
  ).body.user._id;
  const products = [
    {
      ...base,
      name: "Fresh Milk 1L",
      category: "dairy-eggs",
      price: 30,
      stock: 40,
    },
    {
      ...base,
      name: "Eggs Crate",
      category: "dairy-eggs",
      price: 60,
      originalPrice: 75,
      stock: 4,
      isOrganic: true,
    },
    { ...base, name: "Brown Bread", category: "bakery", price: 20, stock: 0 },
  ];
  for (const product of products)
    await admin.post("/api/products").set(header).send(product).expect(201);
});
after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test("category slugs follow the storefront format", () => {
  assert.equal(slugify("Fruits & Vegetables"), "fruits-vegetables");
  assert.equal(slugify("  Dairy & Eggs "), "dairy-eggs");
  assert.equal(slugify("Crème Fraîche"), "creme-fraiche");
});

test("categories: public list with product counts, admin-only writes, slugs fixed, in-use categories protected", async () => {
  await shopper
    .post("/api/categories")
    .set(header)
    .send({ name: "Bakery" })
    .expect(401);
  await request(app)
    .post("/api/categories")
    .set(header)
    .send({ name: "Bakery" })
    .expect(401);

  await request(app).get("/api/categories/manage").expect(401);
  await shopper.get("/api/categories/manage").expect(401);
  assert.deepEqual(
    (await request(app).get("/api/categories").expect(200)).body.unlisted,
    [],
  );
  const before = await admin.get("/api/categories/manage").expect(200);
  assert.deepEqual(before.body.unlisted, [
    { slug: "bakery", productCount: 1, cover: "https://example.com/item.png" },
    {
      slug: "dairy-eggs",
      productCount: 2,
      cover: "https://example.com/item.png",
    },
  ]);

  const dairy = (
    await admin
      .post("/api/categories")
      .set(header)
      .send({ name: "Dairy & Eggs" })
      .expect(201)
  ).body.category;
  assert.equal(dairy.slug, "dairy-eggs");
  assert.equal(dairy.productCount, 2);
  await admin
    .post("/api/categories")
    .set(header)
    .send({ name: "Dairy and eggs", slug: "dairy-eggs" })
    .expect(409);
  await admin
    .post("/api/categories")
    .set(header)
    .send({ name: "Bad", slug: "Not A Slug!" })
    .expect(400);
  await admin
    .post("/api/categories")
    .set(header)
    .send({ name: "Bad", image: "javascript:alert(1)" })
    .expect(400);

  const renamed = await admin
    .patch(`/api/categories/${dairy._id}`)
    .set(header)
    .send({ name: "Dairy", slug: "hijacked" })
    .expect(200);
  assert.equal(renamed.body.category.name, "Dairy");
  assert.equal(renamed.body.category.slug, "dairy-eggs");

  await admin.delete(`/api/categories/${dairy._id}`).set(header).expect(409);
  const snacks = (
    await admin
      .post("/api/categories")
      .set(header)
      .send({ name: "Snacks" })
      .expect(201)
  ).body.category;
  await admin.delete(`/api/categories/${snacks._id}`).set(header).expect(200);
  await admin.delete(`/api/categories/${snacks._id}`).set(header).expect(404);
  await admin.delete("/api/categories/not-an-id").set(header).expect(400);

  const after = await admin.get("/api/categories/manage").expect(200);
  assert.deepEqual(
    after.body.categories.map((c: { slug: string }) => c.slug),
    ["dairy-eggs"],
  );
  assert.deepEqual(after.body.unlisted, [
    { slug: "bakery", productCount: 1, cover: "https://example.com/item.png" },
  ]);
});

test("category visibility, descriptions and image URLs stay consistent across public and management lists", async () => {
  const input = {
    name: "Seasonal picks",
    description: "Fresh produce in season",
    image: "https://example.com/seasonal.webp",
    isActive: false,
  };
  const category = (
    await admin.post("/api/categories").set(header).send(input).expect(201)
  ).body.category;
  assert.equal(category.isActive, false);
  assert.equal(category.description, input.description);
  const publicSlugs = async () =>
    (await request(app).get("/api/categories").expect(200)).body.categories.map(
      (row: { slug: string }) => row.slug,
    );
  assert.ok(!(await publicSlugs()).includes(category.slug));
  assert.ok(
    (
      await admin.get("/api/categories/manage").expect(200)
    ).body.categories.some((row: { _id: string }) => row._id === category._id),
  );
  await shopper
    .patch(`/api/categories/${category._id}`)
    .set(header)
    .send({ isActive: true })
    .expect(401);
  await admin
    .patch(`/api/categories/${category._id}`)
    .set(header)
    .send({ isActive: "yes" })
    .expect(400);
  await admin
    .patch(`/api/categories/${category._id}`)
    .set(header)
    .send({ description: "x".repeat(301) })
    .expect(400);
  await admin
    .patch(`/api/categories/${category._id}`)
    .set(header)
    .send({
      isActive: true,
      name: "Seasonal produce",
      image: "https://example.com/uploaded.png",
      description: "Updated description",
    })
    .expect(200);
  const publicCategory = (
    await request(app).get("/api/categories").expect(200)
  ).body.categories.find((row: { slug: string }) => row.slug === category.slug);
  assert.equal(publicCategory.name, "Seasonal produce");
  assert.equal(publicCategory.image, "https://example.com/uploaded.png");
  assert.equal(publicCategory.description, "Updated description");
  await admin
    .patch(`/api/categories/${category._id}`)
    .set(header)
    .send({ isActive: false })
    .expect(200);
  assert.ok(!(await publicSlugs()).includes(category.slug));
  await admin.delete(`/api/categories/${category._id}`).set(header).expect(200);
});

test("product stats and stock filters use the low-stock threshold", async () => {
  await shopper.get("/api/products/stats").expect(401);
  const { stats } = (await admin.get("/api/products/stats").expect(200)).body;
  assert.equal(stats.total, 3);
  assert.equal(stats.inStock, 2);
  assert.equal(stats.lowStock, 1);
  assert.equal(stats.outOfStock, 1);
  assert.equal(stats.onSale, 1);
  assert.equal(stats.stockUnits, 44);
  assert.equal(stats.inventoryValue, 30 * 40 + 60 * 4);
  assert.equal(
    (await admin.get("/api/products/stats?lowStockBelow=50").expect(200)).body
      .stats.lowStock,
    2,
  );

  const names = async (query: string) =>
    (await request(app).get(`/api/products?${query}`).expect(200)).body.products
      .map((p: { name: string }) => p.name)
      .sort();
  assert.deepEqual(await names("stock=low"), ["Eggs Crate"]);
  assert.deepEqual(await names("stock=out"), ["Brown Bread"]);
  assert.deepEqual(await names("stock=restock"), ["Brown Bread", "Eggs Crate"]);
  assert.deepEqual(await names("stock=in"), ["Eggs Crate", "Fresh Milk 1L"]);
  assert.deepEqual(await names("organic=false"), [
    "Brown Bread",
    "Fresh Milk 1L",
  ]);
  assert.deepEqual(await names("onSale=true"), ["Eggs Crate"]);
  const byStock = (
    await request(app).get("/api/products?sort=stock_asc").expect(200)
  ).body.products.map((p: { stock: number }) => p.stock);
  assert.deepEqual(byStock, [0, 4, 40]);
  await request(app).get("/api/products?stock=plenty").expect(400);
});

test("customers: admin can list, search, view and deactivate; deactivation ends sessions", async () => {
  await shopper.get("/api/admin/customers").expect(401);
  await request(app).get("/api/admin/customers").expect(401);

  const list = (await admin.get("/api/admin/customers?q=ESI").expect(200)).body;
  assert.equal(list.pagination.total, 1);
  assert.equal(list.customers[0].email, "esi@example.com");
  assert.equal(list.customers[0].password, undefined);
  assert.equal(
    (await admin.get("/api/admin/customers?status=inactive").expect(200)).body
      .pagination.total,
    0,
  );

  const stats = (await admin.get("/api/admin/customers/stats").expect(200)).body
    .stats;
  assert.deepEqual(stats, {
    total: 1,
    active: 1,
    inactive: 0,
    joinedThisMonth: 1,
  });

  await shopper
    .post("/api/addresses")
    .set(header)
    .send({
      label: "Home",
      fullName: "Esi Mensah",
      phone: "0241234567",
      addressLine1: "4 Oxford Street",
      city: "Accra",
      region: "Greater Accra",
    })
    .expect(201);
  const detail = (
    await admin.get(`/api/admin/customers/${shopperId}`).expect(200)
  ).body;
  assert.equal(detail.addresses.length, 1);
  assert.equal(detail.addresses[0].isDefault, true);
  await admin.get("/api/admin/customers/not-an-id").expect(400);
  await admin
    .get(`/api/admin/customers/${new mongoose.Types.ObjectId()}`)
    .expect(404);

  await admin
    .patch(`/api/admin/customers/${shopperId}/status`)
    .set(header)
    .send({ isActive: "no" })
    .expect(400);
  const off = await admin
    .patch(`/api/admin/customers/${shopperId}/status`)
    .set(header)
    .send({ isActive: false })
    .expect(200);
  assert.equal(off.body.customer.isActive, false);
  await shopper.get("/api/auth/me").expect(401);
  await request(app)
    .post("/api/auth/login")
    .set(header)
    .send({ email: "esi@example.com", password })
    .expect(403);
  await admin
    .patch(`/api/admin/customers/${shopperId}/status`)
    .set(header)
    .send({ isActive: true })
    .expect(200);
  await request(app)
    .post("/api/auth/login")
    .set(header)
    .send({ email: "esi@example.com", password })
    .expect(200);
});

test("image upload is admin-only and reports a missing Cloudinary setup clearly", async () => {
  await shopper
    .post("/api/admin/uploads/image")
    .set(header)
    .attach("image", Buffer.from("x"), "a.png")
    .expect(401);
  const response = await admin
    .post("/api/admin/uploads/image")
    .set(header)
    .attach("image", Buffer.from("x"), {
      filename: "a.png",
      contentType: "image/png",
    })
    .expect(503);
  assert.match(response.body.message, /image URL/);
});

test("existing image uploads validate files and supply the same public category URL as remote images", async (context) => {
  const hostedUrl = "https://example.com/cloudinary/category.png";
  context.mock.method(cloudinary, "config", () => ({
    cloud_name: "test-only",
  }));
  context.mock.method(
    cloudinary.uploader,
    "upload_stream",
    (...args: unknown[]) => {
      const done = args.at(-1) as (
        error: null,
        result: { secure_url: string },
      ) => void;
      return new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
        final(callback) {
          done(null, { secure_url: hostedUrl });
          callback();
        },
      });
    },
  );
  await request(app)
    .post("/api/admin/uploads/image")
    .set(header)
    .attach("image", Buffer.from("x"), "a.png")
    .expect(401);
  await admin
    .post("/api/admin/uploads/image")
    .set(header)
    .attach("image", Buffer.from("x"), {
      filename: "a.txt",
      contentType: "text/plain",
    })
    .expect(400);
  await admin
    .post("/api/admin/uploads/image")
    .set(header)
    .attach("image", Buffer.alloc(2 * 1024 * 1024 + 1), {
      filename: "large.png",
      contentType: "image/png",
    })
    .expect(413);
  const upload = await admin
    .post("/api/admin/uploads/image?folder=content")
    .set(header)
    .attach("image", Buffer.from("test-image"), {
      filename: "category.png",
      contentType: "image/png",
    })
    .expect(201);
  assert.equal(upload.body.url, hostedUrl);
  const category = (
    await admin
      .post("/api/categories")
      .set(header)
      .send({ name: "Uploaded category", image: upload.body.url })
      .expect(201)
  ).body.category;
  const publicCategory = (
    await request(app).get("/api/categories").expect(200)
  ).body.categories.find((row: { _id: string }) => row._id === category._id);
  assert.equal(publicCategory.image, hostedUrl);
  await admin.delete(`/api/categories/${category._id}`).set(header).expect(200);
});

test("favicons upload as PNG, JPG, WebP or ICO up to 1 MB, save with the search settings, and only the admin can change them", async (context) => {
  const hostedUrl = "https://example.com/cloudinary/favicon.ico";
  const folders: unknown[] = [];
  context.mock.method(cloudinary, "config", () => ({ cloud_name: "test-only" }));
  context.mock.method(cloudinary.uploader, "upload_stream", (...args: unknown[]) => {
    folders.push((args[0] as { folder: string }).folder);
    const done = args.at(-1) as (error: null, result: { secure_url: string }) => void;
    return new Writable({
      write(_chunk, _encoding, callback) { callback(); },
      final(callback) { done(null, { secure_url: hostedUrl }); callback(); },
    });
  });
  const icon = (contentType: string, size = 64) => ({ filename: "favicon", contentType, size });
  const send = (agent: typeof admin, folder: string, file: ReturnType<typeof icon>) =>
    agent.post(`/api/admin/uploads/image?folder=${folder}`).set(header).attach("image", Buffer.alloc(file.size, 1), { filename: file.filename, contentType: file.contentType });

  // Shoppers can neither upload nor save one.
  await send(shopper, "favicon", icon("image/png")).expect(401);
  for (const type of ["image/x-icon", "image/vnd.microsoft.icon", "image/png", "image/jpeg", "image/webp"]) {
    assert.equal((await send(admin, "favicon", icon(type)).expect(201)).body.url, hostedUrl);
  }
  assert.ok(folders.every((folder) => folder === "greenfarm/favicon"));
  await send(admin, "favicon", icon("image/svg+xml")).expect(400);
  await send(admin, "favicon", icon("image/png", 1024 * 1024 + 1)).expect(400);
  // .ico is for favicons only.
  await send(admin, "products", icon("image/x-icon")).expect(400);

  const { content } = (await admin.get("/api/admin/content").expect(200)).body;
  assert.equal(content.seo.favicon, "");
  await shopper.put("/api/admin/content/seo").set(header).send({ ...content.seo, favicon: hostedUrl }).expect(401);
  await request(app).put("/api/admin/content/seo").set(header).send({ ...content.seo, favicon: hostedUrl }).expect(401);
  await admin.put("/api/admin/content/seo").set(header).send({ ...content.seo, favicon: hostedUrl }).expect(200);
  assert.equal((await request(app).get("/api/content").expect(200)).body.seo.favicon, hostedUrl);
  // A rejected save keeps the current favicon.
  await admin.put("/api/admin/content/seo").set(header).send({ ...content.seo, favicon: "http://example.com/icon.png" }).expect(400);
  await admin.put("/api/admin/content/seo").set(header).send({ ...content.seo, favicon: "javascript:alert(1)" }).expect(400);
  assert.equal((await request(app).get("/api/content").expect(200)).body.seo.favicon, hostedUrl);
  await admin.put("/api/admin/content/seo").set(header).send(content.seo).expect(200);
  assert.equal((await request(app).get("/api/content").expect(200)).body.seo.favicon, "");
});
