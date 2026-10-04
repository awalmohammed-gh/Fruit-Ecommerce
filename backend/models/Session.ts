import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

export const ACCOUNT_TYPES = ['customer', 'admin', 'partner'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * One sign-in. The JWT in the account type's cookie carries a random token ID; only its hash is stored here.
 * Signing out deletes the record, and MongoDB removes expired ones.
 */
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  accountType: { type: String, enum: ACCOUNT_TYPES, required: true },
  // A User or DeliveryPartner ID, or "admin" for the .env admin.
  accountId: { type: String, required: true, index: true },
  // The account's token version at sign-in. Changing a password or suspending an account bumps it,
  // which ends every older session for that account.
  version: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  // Last request made with this sign-in. Admin sign-ins end after a period without any (see middleware/auth.ts).
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Session', schema);
