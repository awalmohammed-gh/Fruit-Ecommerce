import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { orderLimits } from '../config/orderLimits.js';

const line = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, max: orderLimits.maxPerProduct, validate: Number.isInteger },
}, { _id: false });

// Persist only ownership, product references and quantities. Prices always come from Product.
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: { type: [line], default: [], validate: (items: unknown[]) => items.length <= 50 },
}, { timestamps: true, optimisticConcurrency: true });

export type CartDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Cart', schema);
