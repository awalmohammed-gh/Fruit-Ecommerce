import mongoose, {
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import bcrypt from "bcryptjs";

export const TRANSPORT_TYPES = [
  "motorbike",
  "bicycle",
  "car",
  "van",
  "other",
] as const;
// Motorised transport needs a registered vehicle and a licensed driver.
export const MOTORISED: readonly string[] = ["motorbike", "car", "van"];
export const ID_TYPES = [
  "ghana-card",
  "passport",
  "voter-id",
  "drivers-license",
] as const;
export const AVAILABILITY = [
  "full-time",
  "weekdays",
  "weekends",
  "evenings",
  "flexible",
] as const;
export const APPLICATION_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Suspended",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * A delivery partner is its own account, separate from customer Users: anyone can apply from the public
 * site, management approves them, and they then set a password and sign in to the delivery dashboard.
 * The same person may also have a customer account; the two are never linked.
 */
const schema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    // One live application per email (see the index below); earlier rejected ones are kept as replaced.
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    dateOfBirth: { type: Date, required: true },
    region: { type: String, required: true },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    digitalAddress: { type: String, trim: true, default: "", maxlength: 40 },
    transportType: { type: String, enum: TRANSPORT_TYPES, required: true },
    vehicleType: { type: String, trim: true, default: "", maxlength: 80 },
    vehicleRegistration: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
    },
    licenseNumber: { type: String, trim: true, default: "", maxlength: 40 },
    idType: { type: String, enum: ID_TYPES, required: true },
    idNumber: { type: String, required: true, trim: true, maxlength: 40 },
    emergencyContact: {
      name: { type: String, required: true, trim: true, maxlength: 100 },
      phone: { type: String, required: true, trim: true, maxlength: 25 },
    },
    availability: { type: String, enum: AVAILABILITY, required: true },
    notes: { type: String, trim: true, default: "", maxlength: 500 },

    // ---- Account. Set when an approved applicant activates; only ever stored hashed. ----
    password: { type: String, select: false },
    // Proves who applied: shown once on submission, needed to check status and to activate. Stored hashed.
    referenceHash: { type: String, select: false },
    tokenVersion: { type: Number, default: 0, select: false },
    accountActivated: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },

    // ---- Management-only. Nothing below is ever read from an applicant's or partner's request body. ----
    applicationStatus: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "Pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    // Set on a rejected application once its applicant applies again. The new application is a separate record
    // (pointing back here through previousApplication), so nobody can overwrite an earlier application.
    replaced: { type: Boolean, default: false },
    previousApplication: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryPartner", default: null },
    suspensionReason: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, default: "" },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: APPLICATION_STATUSES, required: true },
        note: { type: String, default: "" },
        by: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });
schema.index({ email: 1 }, { unique: true, partialFilterExpression: { replaced: false }, name: "one_live_application_per_email" });
schema.index({ phone: 1 });

schema.pre("save", async function () {
  if (this.isModified("password") && this.password) this.password = await bcrypt.hash(this.password, 12);
});

export type DeliveryPartnerDocument = HydratedDocument<
  InferSchemaType<typeof schema>
>;
export default mongoose.model("DeliveryPartner", schema);
