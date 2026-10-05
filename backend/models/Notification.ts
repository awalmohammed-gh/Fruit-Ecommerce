import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ACCOUNT_TYPES } from './Session.js';

export const NOTIFICATION_RETENTION_MS = 90 * 86_400_000;
const schema = new mongoose.Schema({
  audience: { type: String, enum: ['individual', 'customers', 'all'], required: true },
  // The existing environment admin has ID "admin"; customers and partners use MongoDB IDs.
  recipient: { type: String, default: null },
  recipientAccount: { type: String, enum: ACCOUNT_TYPES, default: null },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  type: { type: String, required: true, trim: true, maxlength: 40, default: 'system' },
  link: { type: String, default: '', maxlength: 500 },
  createdBy: { type: String, default: null },
  sequence: { type: Number, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, required: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + NOTIFICATION_RETENTION_MS), required: true },
}, { toJSON: { versionKey: false } });

schema.pre('validate', function () {
  if (this.audience === 'individual' && (!this.recipient || !this.recipientAccount))
    this.invalidate('recipient', 'Individual notifications require a recipient and account type');
  if (this.audience !== 'individual' && (this.recipient || this.recipientAccount))
    this.invalidate('recipient', 'Broadcast notifications cannot have a private recipient');
});
schema.index({ audience: 1, sequence: -1 });
schema.index({ recipientAccount: 1, recipient: 1, sequence: -1 });
schema.index({ audience: 1, createdAt: -1 });
schema.index({ recipient: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type NotificationDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Notification', schema);

// Incremented inside the same transaction as notification creation. Committed sequences cannot arrive
// behind a polling cursor, even when two order transactions commit in a different order.
const counterSchema = new mongoose.Schema({ _id: String, value: { type: Number, default: 0, required: true } });
export const NotificationCounter = mongoose.model('NotificationCounter', counterSchema);
