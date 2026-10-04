import mongoose, { type InferSchemaType } from 'mongoose';
import { SEO_DEFAULTS } from '../config/siteDefaults.js';

// Everything the admin edits about the storefront except promotional banners (see Banner.ts).
// There is exactly one document, found by key "site". Each block is saved on its own from Admin → Settings.

const text = (maxlength: number) => ({ type: String, trim: true, default: '', maxlength });

// One hero picture with its words. Single mode uses `hero.single`; slider mode uses `hero.slides`, in array order.
const slide = new mongoose.Schema({
  image: text(2048),
  label: text(60),
  heading: text(90),
  // Shown on its own line in the accent colour, after the heading.
  highlight: text(60),
  description: text(240),
  primaryText: text(30),
  primaryLink: text(300),
  secondaryText: text(30),
  secondaryLink: text(300),
  active: { type: Boolean, default: true },
});

// An advertisement block on the home page (delivery partner recruitment, deals strip).
const advert = new mongoose.Schema({
  active: { type: Boolean, default: true },
  label: text(60),
  title: text(90),
  description: text(300),
  points: { type: [text(60)], default: [] },
  ctaText: text(30),
  ctaLink: text(300),
  image: text(2048),
}, { _id: false });

const sectionHeading = new mongoose.Schema({ eyebrow: text(60), heading: text(80), description: text(200) }, { _id: false });

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, immutable: true },
  store: {
    description: text(300),
    address: text(160),
    phone: text(25),
    email: text(254),
  },
  announcement: {
    active: { type: Boolean, default: true },
    message: text(90),
    secondary: text(90),
  },
  hero: {
    mode: { type: String, enum: ['single', 'slider'], default: 'single' },
    // Seconds between slides; 0 turns automatic sliding off.
    autoplaySeconds: { type: Number, min: 0, max: 30, default: 6 },
    single: { type: slide, default: () => ({}) },
    slides: { type: [slide], default: [] },
  },
  sections: {
    features: { type: [new mongoose.Schema({ title: text(40), description: text(80) }, { _id: false })], default: [] },
    categories: { type: sectionHeading, default: () => ({}) },
    popular: { type: sectionHeading, default: () => ({}) },
  },
  ads: {
    partner: { type: advert, default: () => ({}) },
    newsletter: { type: advert, default: () => ({}) },
  },
  // Search and sharing defaults (Settings → SEO & Sharing). Each field has a default, so older documents get them too.
  seo: {
    siteName: { type: String, trim: true, default: SEO_DEFAULTS.siteName, maxlength: 60 },
    defaultTitle: { type: String, trim: true, default: SEO_DEFAULTS.defaultTitle, maxlength: 70 },
    defaultDescription: { type: String, trim: true, default: SEO_DEFAULTS.defaultDescription, maxlength: 160 },
    socialImage: { type: String, trim: true, default: SEO_DEFAULTS.socialImage, maxlength: 2048 },
  },
}, { timestamps: true, toJSON: { versionKey: false } });

export type SiteContent = InferSchemaType<typeof schema>;
export const CONTENT_BLOCKS = ['store', 'announcement', 'hero', 'sections', 'ads', 'seo'] as const;
export type ContentBlock = typeof CONTENT_BLOCKS[number];
export default mongoose.model('SiteContent', schema);
