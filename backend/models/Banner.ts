import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

// Where a promotional banner appears on the storefront.
export const PLACEMENTS = ['home-top', 'home-middle', 'home-bottom', 'products', 'category'] as const;
export type Placement = typeof PLACEMENTS[number];

const text = (maxlength: number) => ({ type: String, trim: true, default: '', maxlength });

const schema = new mongoose.Schema({
  // Admin-only name for the list, e.g. "Weekend dairy promo".
  name: { type: String, required: true, trim: true, maxlength: 80 },
  placement: { type: String, enum: PLACEMENTS, required: true },
  // Category banners only: the category slug they show on; empty means every category.
  category: text(60),
  badge: text(40),
  title: { type: String, required: true, trim: true, maxlength: 90 },
  highlight: text(60),
  description: text(240),
  image: text(2048),
  buttonText: text(30),
  buttonLink: text(300),
  active: { type: Boolean, default: false },
  // Optional schedule: shown only between these dates while active.
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
}, { timestamps: true, toJSON: { versionKey: false } });

schema.index({ placement: 1, active: 1 });

export type BannerDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Banner', schema);
