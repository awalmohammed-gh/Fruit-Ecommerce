import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

export const DELIVERY_STATUSES = ['Assigned', 'Accepted', 'Picked Up', 'On The Way', 'Delivered', 'Failed Delivery', 'Declined', 'Reassigned', 'Cancelled'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
// Still with the partner. Everything else is a final state.
export const OPEN_DELIVERY_STATUSES: DeliveryStatus[] = ['Assigned', 'Accepted', 'Picked Up', 'On The Way'];
export const FAILURE_REASONS = ['Customer unreachable', 'Wrong or incomplete address', 'Customer refused delivery', 'Customer asked to reschedule', 'Vehicle problem', 'Other'] as const;

/**
 * One partner's attempt at delivering one order. Reassigning closes the current record and opens a new one,
 * so an order keeps a trace of everyone who handled it.
 */
const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true },
  assignedBy: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  status: { type: String, enum: DELIVERY_STATUSES, default: 'Assigned' },
  // True while the partner still holds the delivery.
  active: { type: Boolean, default: true },
  notes: { type: String, trim: true, default: '', maxlength: 500 },
  failureReason: { type: String, default: '' },
  history: [{
    _id: false,
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    note: { type: String, default: '' },
    by: { type: String, enum: ['management', 'partner'], required: true },
    at: { type: Date, default: Date.now },
  }],
  completedAt: { type: Date, default: null },
}, { timestamps: true });

// An order can only be with one partner at a time.
schema.index({ order: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'one_active_assignment_per_order' });
schema.index({ deliveryPartner: 1, active: 1, assignedAt: -1 });
schema.index({ status: 1, updatedAt: -1 });

export type AssignmentDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export default mongoose.model('DeliveryAssignment', schema);
