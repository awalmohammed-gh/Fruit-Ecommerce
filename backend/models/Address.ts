import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { regions } from '../config/regions.js';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, required: true, trim: true, maxlength: 60 },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 25 },
  addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
  addressLine2: { type: String, trim: true, default: '', maxlength: 200 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  region: { type: String, required: true, enum: regions },
  digitalAddress: { type: String, trim: true, default: '', maxlength: 40 },
  landmark: { type: String, trim: true, default: '', maxlength: 200 },
  country: { type: String, trim: true, default: 'Ghana', maxlength: 100 },
}, { timestamps: true });
export type AddressDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export function safeAddress(address: AddressDocument, defaultAddress: mongoose.Types.ObjectId | null | undefined) {
  const { user: _owner, __v: _version, ...fields } = address.toObject();
  return { ...fields, isDefault: String(address._id) === String(defaultAddress) };
}
export default mongoose.model('Address', schema);
