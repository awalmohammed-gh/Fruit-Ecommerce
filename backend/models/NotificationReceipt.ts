import mongoose from 'mongoose';
import { ACCOUNT_TYPES } from './Session.js';

// Read and dismissal status belong to an account, never to the shared notification itself.
const schema = new mongoose.Schema({
  notification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
  accountType: { type: String, enum: ACCOUNT_TYPES, required: true },
  accountId: { type: String, required: true },
  readAt: { type: Date, default: null },
  dismissedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
});
schema.index({ notification: 1, accountType: 1, accountId: 1 }, { unique: true });
schema.index({ accountType: 1, accountId: 1, readAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('NotificationReceipt', schema);
