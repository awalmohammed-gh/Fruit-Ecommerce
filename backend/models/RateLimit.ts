import mongoose from 'mongoose';

/**
 * One rate-limit counter: requests from an address to one endpoint, or failed attempts against one account or
 * delivery. Kept in MongoDB so the counts survive restarts and are shared by every API instance. MongoDB
 * deletes a counter once its window has passed.
 */
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RateLimit', schema);
