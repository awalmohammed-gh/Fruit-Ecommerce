import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Display name captured when the review is written.
  authorName: { type: String, required: true, trim: true, maxlength: 100 },
  rating: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'rating must be a whole number' } },
  comment: { type: String, trim: true, default: '', maxlength: 1000 },
}, { timestamps: true, toJSON: { versionKey: false } });

// One review per customer per product; writing again updates it.
schema.index({ product: 1, user: 1 }, { unique: true });
schema.index({ product: 1, createdAt: -1 });

export type ReviewDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Review', schema);
