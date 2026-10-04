import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

export const categorySlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "Fruits & Vegetables" -> "fruits-vegetables". Used for category and product slugs.
export function slugify(name: string) {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// 140 -> 130 is a 7% discount. A product that isn't marked down is always 0.
export function discountFor(price: number, originalPrice: number) {
  if (!(originalPrice > price)) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

const wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  price: { type: Number, required: true, min: 0 },
  // Equal to price when the product isn't on sale, so clients can always compare the two.
  originalPrice: { type: Number, min: 0 },
  image: { type: String, required: true, trim: true, maxlength: 2048 },
  // Free-form slug rather than an enum so new categories don't need a schema change.
  category: { type: String, required: true, trim: true, lowercase: true, maxlength: 60, match: categorySlug },
  unit: { type: String, required: true, trim: true, maxlength: 30 },
  stock: { type: Number, required: true, default: 0, min: 0, validate: wholeNumber },
  isOrganic: { type: Boolean, default: false },
  // Owned by the review system; the product endpoints never write these.
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0, min: 0, validate: wholeNumber },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  // Readable address: /products/cheese-200g. Made from the name once, then kept so links never break.
  slug: { type: String, trim: true, lowercase: true, maxlength: 140, match: categorySlug },
  // Optional search-engine overrides; empty means the page uses the name and description.
  seoTitle: { type: String, trim: true, default: '', maxlength: 70 },
  seoDescription: { type: String, trim: true, default: '', maxlength: 160 },
}, { timestamps: true, toJSON: { versionKey: false } });

schema.index({ category: 1, price: 1 });
schema.index({ createdAt: -1 });
schema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } });

schema.pre('validate', function () {
  if (this.originalPrice == null) this.originalPrice = this.price;
  if (this.originalPrice < this.price) this.invalidate('originalPrice', 'Original price cannot be lower than the selling price');
  this.discount = discountFor(this.price, this.originalPrice);
});

// Products created without a slug get one from their name; a taken slug gets -2, -3, ...
// A slug never looks like a database ID, so /products/:idOrSlug is never ambiguous.
schema.pre('validate', async function () {
  if (this.slug) return;
  const base = (slugify(this.name || '') || 'product').slice(0, 120);
  const safe = /^[a-f0-9]{24}$/.test(base) ? `${base}-item` : base;
  const Model = this.constructor as mongoose.Model<unknown>;
  let candidate = safe;
  for (let n = 2; await Model.exists({ slug: candidate, _id: { $ne: this._id } }); n++) candidate = `${safe}-${n}`;
  this.slug = candidate;
});

export type ProductDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Product', schema);
