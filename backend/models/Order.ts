import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { DELIVERY_STATUSES } from './DeliveryAssignment.js';

// Packed means ready for delivery; Assigned onwards follows the delivery partner's progress.
export const ORDER_STATUSES = ['Order Placed', 'Confirmed', 'Packed', 'Assigned', 'Out for Delivery', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const FINAL_STATUSES: OrderStatus[] = ['Delivered', 'Cancelled'];
// The customer only sees the delivery code once a partner is on the way to them.
export const OTP_VISIBLE_STATUSES: OrderStatus[] = ['Assigned', 'Out for Delivery'];
// Management can assign a partner once the order is confirmed.
export const READY_FOR_DELIVERY: OrderStatus[] = ['Confirmed', 'Packed', 'Assigned', 'Out for Delivery'];

const money = { type: Number, required: true, min: 0 };

// Items and address are copied onto the order so later product or address edits don't rewrite history.
const item = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  unit: { type: String, required: true },
  price: money,
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const schema = new mongoose.Schema({
  // Short reference shown to people ("#D67DAC12") and searchable by admins.
  number: { type: String, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer: { name: { type: String, required: true }, email: { type: String, required: true }, phone: { type: String, default: '' } },
  items: { type: [item], validate: { validator: (items: unknown[]) => items.length > 0, message: 'An order needs at least one item' } },
  shippingAddress: {
    label: String, fullName: String, phone: String, addressLine1: String, addressLine2: String,
    city: String, region: String, digitalAddress: String, landmark: String, country: String,
  },
  paymentMethod: { type: String, enum: ['cash'], required: true },
  isPaid: { type: Boolean, default: false },
  paidAt: { type: Date, default: null },
  subtotal: money, deliveryFee: money, tax: money, total: money,
  status: { type: String, enum: ORDER_STATUSES, default: 'Order Placed', index: true },
  statusHistory: [{ _id: false, status: { type: String, enum: ORDER_STATUSES, required: true }, note: { type: String, default: '' }, timestamp: { type: Date, default: Date.now } }],
  cancelReason: { type: String, default: '' },
  // The current partner and assignment. Past assignments stay in the DeliveryAssignment collection.
  deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: null, index: true },
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAssignment', default: null },
  // Mirrors the latest assignment; kept separate from payment (isPaid) and from the order status.
  deliveryStatus: { type: String, enum: [...DELIVERY_STATUSES, null], default: null },
  // Never sent to admins or partners; the partner must get it from the customer at the door.
  deliveryOtp: { type: String, required: true, select: false },
  liveLocation: { lat: Number, lng: Number, updatedAt: Date },
  // The storefront's ID for the checkout attempt that created this order, so sending it twice creates one order.
  checkoutKey: { type: String, select: false },
  // Set once stock has been put back, so a cancelled order can never restock twice.
  stockRestored: { type: Boolean, default: false, select: false },
}, { timestamps: true });

schema.pre('validate', function () {
  if (!this.number) this.number = String(this._id).slice(-8).toUpperCase();
});

schema.index({ createdAt: -1 });
schema.index({ user: 1, checkoutKey: 1 }, { unique: true, partialFilterExpression: { checkoutKey: { $type: 'string' } } });
schema.index({ status: 1, createdAt: 1 });
schema.index({ 'customer.email': 1 });

export type OrderDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('Order', schema);
