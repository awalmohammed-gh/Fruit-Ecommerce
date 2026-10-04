import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { categorySlug, slugify } from './Product.js';

export { slugify };

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  // Products reference categories by slug, so it never changes after creation.
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 60, match: categorySlug, immutable: true },
  image: { type: String, trim: true, default: '', maxlength: 2048 },
  description: { type: String, trim: true, default: '', maxlength: 300 },
  isActive: { type: Boolean, default: true },
  // Optional search-engine and sharing overrides; empty means the name, description and image are used.
  seoTitle: { type: String, trim: true, default: '', maxlength: 70 },
  seoDescription: { type: String, trim: true, default: '', maxlength: 160 },
  seoImage: { type: String, trim: true, default: '', maxlength: 2048 },
}, { timestamps: true, toJSON: { versionKey: false } });

export type CategoryDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Category', schema);
