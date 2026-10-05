import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import bcrypt from 'bcryptjs';
const notifications = new mongoose.Schema({
  order: { type: Boolean, default: true }, account: { type: Boolean, default: true },
  promotion: { type: Boolean, default: true }, system: { type: Boolean, default: true },
}, { _id: false });
const preferences = new mongoose.Schema({
  productSort: { type: String, enum: ['newest', 'rating', 'price_asc', 'price_desc', 'name'], default: 'newest' },
  notifications: { type: notifications, default: () => ({}) },
}, { _id: false });
const schema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, trim: true, default: '', maxlength: 25 },
  password: { type: String, required: true, select: false },
  avatar: { type: String, default: '', maxlength: 2048 },
  preferences: { type: preferences, default: () => ({}) },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0, select: false },
  defaultAddress: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', default: null },
  addressRevision: { type: Number, default: 0, select: false },
}, { timestamps: true, optimisticConcurrency: true });
schema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
export type UserDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export function safeUser(user: UserDocument) {
  return { _id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, avatar: user.avatar,
    role: user.role, isActive: user.isActive, preferences: user.preferences, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
export default mongoose.model('User', schema);
