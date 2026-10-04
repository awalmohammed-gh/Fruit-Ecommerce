import mongoose, { type InferSchemaType } from 'mongoose';

// Personal settings belong to the configured admin, never to the storefront content document.
const preferences = new mongoose.Schema({
  appearance: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
  sidebar: { type: String, enum: ['expanded', 'collapsed'], default: 'expanded' },
  tableDensity: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
  pageSize: { type: Number, enum: [10, 20, 50, 100], default: 20 },
  dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'DD/MM/YYYY' },
  timeFormat: { type: String, enum: ['12-hour', '24-hour'], default: '24-hour' },
  currencyDisplay: { type: String, enum: ['symbol', 'code'], default: 'symbol' },
}, { _id: false });
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  fullName: { type: String, default: 'GreenFarm Admin', maxlength: 100 },
  phone: { type: String, default: '', maxlength: 25 },
  avatar: { type: String, default: '', maxlength: 2048 },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  passwordHash: { type: String, default: '', select: false },
  bootstrapVersion: { type: String, required: true },
  preferences: { type: preferences, default: () => ({}) },
}, { timestamps: true, optimisticConcurrency: true });
export type AdminSettingsData = InferSchemaType<typeof schema>;
export default mongoose.model('AdminSettings', schema);
