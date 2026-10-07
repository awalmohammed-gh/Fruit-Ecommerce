// One-off: copies product and category pictures that are hosted elsewhere (e.g. raw.githubusercontent.com) to
// Cloudinary and points the records at the copies. Cloudinary pictures are resized and converted to WebP/AVIF for
// each card on request (frontend sizedImage), so a 155 px product card stops downloading a 140 KB, 432 px PNG.
//
//   npx tsx scripts/moveImagesToCloudinary.ts           lists what would move (changes nothing)
//   npx tsx scripts/moveImagesToCloudinary.ts --apply   uploads and updates the records
//
// Uses MONGODB_URI, MONGODB_DB_NAME and the CLOUD_* settings from backend/.env: check which database they name first.
import 'dotenv/config';
import mongoose from 'mongoose';
import { openDatabase } from '../config/database.js';
import { connectCloudinary } from '../config/cloudinary.js';
import { uploadImage } from '../services/images.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const apply = process.argv.includes('--apply');
const MAX_BYTES = 10 * 1024 * 1024;
const external = (url: unknown): url is string => typeof url === 'string' && /^https?:\/\//.test(url) && !url.includes('res.cloudinary.com');

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no content type'})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error('larger than 10 MB');
  return buffer;
}

const dbName = process.env.MONGODB_DB_NAME?.trim() || undefined;
await openDatabase(process.env.MONGODB_URI, dbName);
connectCloudinary();
console.log(`Database: ${mongoose.connection.name}${apply ? '' : ' (dry run: nothing is changed; add --apply to move the pictures)'}`);

const [products, categories] = await Promise.all([
  Product.find().select('image').lean(),
  Category.find().select('image').lean(),
]);
const urls = new Set([...products, ...categories].map((record) => record.image).filter(external));
console.log(`${urls.size} picture${urls.size === 1 ? '' : 's'} hosted outside Cloudinary, used by ${products.filter((p) => external(p.image)).length} products and ${categories.filter((c) => external(c.image)).length} categories.`);

let moved = 0;
for (const url of urls) {
  if (!apply) { console.log(`  would move ${url}`); continue; }
  try {
    const uploaded = await uploadImage(await download(url), { folder: 'greenfarm/products' });
    const [productUpdate, categoryUpdate] = await Promise.all([
      Product.updateMany({ image: url }, { $set: { image: uploaded.secure_url } }),
      Category.updateMany({ image: url }, { $set: { image: uploaded.secure_url } }),
    ]);
    moved++;
    console.log(`  moved ${url}\n     -> ${uploaded.secure_url} (${productUpdate.modifiedCount} products, ${categoryUpdate.modifiedCount} categories)`);
  } catch (error) {
    console.error(`  kept  ${url}: ${error instanceof Error ? error.message : error}`);
  }
}
if (apply) console.log(`Moved ${moved} of ${urls.size}.`);
await mongoose.disconnect();
