import { HttpError } from './errors.js';
import { regions } from '../config/regions.js';
import { categorySlug } from '../models/Product.js';
import { slugify } from '../models/Category.js';
import { AVAILABILITY, ID_TYPES, MOTORISED, TRANSPORT_TYPES } from '../models/DeliveryPartner.js';
import { orderLimits } from '../config/orderLimits.js';
type Body = Record<string, unknown>;
export function bodyObject(body: unknown): asserts body is Body {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'A JSON object is required');
}
export function text(body: Body, key: string, { required = false, max = 100, fallback = '' } = {}) {
  const raw = body[key];
  if (raw === undefined && !required) return fallback;
  if (typeof raw !== 'string') throw new HttpError(400, `${key} must be text`);
  const value = raw.trim();
  if (required && !value) throw new HttpError(400, `${key} is required`);
  if (value.length > max) throw new HttpError(400, `${key} must be at most ${max} characters`);
  return value;
}
export function phone(body: Body, required = false, key = 'phone') {
  const value = text(body, key, { required, max: 25 });
  const digits = value.replace(/\D/g, '').length;
  if (value && (!/^[+\d\s().-]+$/.test(value) || digits < 7 || digits > 15)) throw new HttpError(400, 'Please enter a valid phone number');
  return value;
}
export function email(body: Body) {
  const value = text(body, 'email', { required: true, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new HttpError(400, 'Please enter a valid email address');
  return value;
}
export function password(body: Body, key = 'password', isNew = true) {
  const value = body[key];
  if (typeof value !== 'string' || !value || Buffer.byteLength(value) > 72 || (isNew && value.length < 8)) throw new HttpError(400, `${key} must be ${isNew ? 'at least 8 characters and ' : ''}no more than 72 bytes`);
  return value;
}
export function profile(body: unknown, partial = false) {
  bodyObject(body);
  const fields: { fullName?: string; phone?: string; avatar?: string } = {};
  if (!partial || body.fullName !== undefined) fields.fullName = text(body, 'fullName', { required: true });
  if (!partial || body.phone !== undefined) fields.phone = phone(body);
  if (body.avatar !== undefined) {
    fields.avatar = text(body, 'avatar', { max: 2048 });
    if (fields.avatar) {
      let url: URL;
      try { url = new URL(fields.avatar); } catch { throw new HttpError(400, 'Avatar must be an HTTPS image URL'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw new HttpError(400, 'Avatar must be an HTTPS image URL');
    }
  }
  return fields;
}
export function address(body: unknown, partial = false) {
  bodyObject(body);
  const lengths = { label: 60, fullName: 100, addressLine1: 200, addressLine2: 200, city: 100, region: 100, digitalAddress: 40, landmark: 200, country: 100 };
  const required = ['label', 'fullName', 'addressLine1', 'city', 'region'];
  const fields: Record<string, string> = {};
  for (const [key, max] of Object.entries(lengths)) {
    if (partial && body[key] === undefined) continue;
    fields[key] = text(body, key, { required: required.includes(key), max, fallback: key === 'country' ? 'Ghana' : '' });
  }
  if (!partial || body.phone !== undefined) fields.phone = phone(body, true);
  if (fields.region !== undefined && !regions.includes(fields.region)) throw new HttpError(400, 'Select a valid Ghana region');
  if (fields.country === '') throw new HttpError(400, 'Country is required');
  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') throw new HttpError(400, 'isDefault must be true or false');
  return { fields, makeDefault: body.isDefault === true };
}
// Accepts numbers or numeric strings (HTML number inputs submit strings).
function amount(body: Body, key: string, { required = false, integer = false } = {}) {
  let raw = body[key];
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw new HttpError(400, `${key} is required`);
    return undefined;
  }
  if (typeof raw === 'string' && raw.trim()) raw = Number(raw);
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) throw new HttpError(400, `${key} must be a number of zero or more`);
  if (integer && !Number.isInteger(raw)) throw new HttpError(400, `${key} must be a whole number`);
  return raw;
}
const cents = (value: number) => Math.round(value * 100) / 100;
export interface ProductFields {
  name?: string; description?: string; unit?: string; category?: string; image?: string;
  price?: number; originalPrice?: number | null; stock?: number; isOrganic?: boolean;
  seoTitle?: string; seoDescription?: string;
}
// rating, reviewCount, discount and timestamps are deliberately not read from the body.
export function product(body: unknown, partial = false) {
  bodyObject(body);
  const fields: ProductFields = {};
  const has = (key: string) => !partial || body[key] !== undefined;
  if (has('name')) fields.name = text(body, 'name', { required: true, max: 120 });
  if (has('description')) fields.description = text(body, 'description', { required: true, max: 1000 });
  if (has('unit')) fields.unit = text(body, 'unit', { required: true, max: 30 });
  if (has('category')) {
    fields.category = text(body, 'category', { required: true, max: 60 }).toLowerCase();
    if (!categorySlug.test(fields.category)) throw new HttpError(400, 'category must be a slug such as dairy-eggs');
  }
  if (has('image')) fields.image = imageUrl(body, 'image', true);
  if (has('price')) fields.price = cents(amount(body, 'price', { required: true })!);
  // null or '' clears the sale price; it then falls back to the selling price.
  if (body.originalPrice !== undefined) {
    const value = amount(body, 'originalPrice');
    fields.originalPrice = value === undefined ? null : cents(value);
  }
  // Stock defaults to 0 on create, but an update can't blank it.
  if (has('stock')) fields.stock = amount(body, 'stock', { required: partial, integer: true }) ?? 0;
  if (body.isOrganic !== undefined) {
    if (typeof body.isOrganic !== 'boolean') throw new HttpError(400, 'isOrganic must be true or false');
    fields.isOrganic = body.isOrganic;
  }
  // Optional search-engine overrides (empty = use the name and description).
  if (body.seoTitle !== undefined) fields.seoTitle = text(body, 'seoTitle', { max: 70 });
  if (body.seoDescription !== undefined) fields.seoDescription = text(body, 'seoDescription', { max: 160 });
  return fields;
}
function imageUrl(body: Body, key: string, required: boolean) {
  const value = text(body, key, { required, max: 2048 });
  if (!value) return value;
  let url: URL;
  try { url = new URL(value); } catch { throw new HttpError(400, `${key} must be an image URL`); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new HttpError(400, `${key} must be an image URL`);
  return value;
}
// The slug is derived from the name unless one is supplied; updates can't change it.
export function category(body: unknown, partial = false) {
  bodyObject(body);
  const fields: { name?: string; slug?: string; image?: string; description?: string; isActive?: boolean; seoTitle?: string; seoDescription?: string; seoImage?: string } = {};
  if (!partial || body.name !== undefined) fields.name = text(body, 'name', { required: true, max: 60 });
  if (body.image !== undefined) fields.image = imageUrl(body, 'image', false);
  if (body.description !== undefined) fields.description = text(body, 'description', { max: 300 });
  if (body.seoTitle !== undefined) fields.seoTitle = text(body, 'seoTitle', { max: 70 });
  if (body.seoDescription !== undefined) fields.seoDescription = text(body, 'seoDescription', { max: 160 });
  if (body.seoImage !== undefined) fields.seoImage = imageUrl(body, 'seoImage', false);
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false');
    fields.isActive = body.isActive;
  }
  if (!partial) {
    const supplied = text(body, 'slug', { max: 60 }).toLowerCase();
    fields.slug = supplied || slugify(fields.name!);
    if (!categorySlug.test(fields.slug)) throw new HttpError(400, 'slug must use lowercase letters, numbers and hyphens, such as dairy-eggs');
  }
  return fields;
}
const objectId = /^[a-f\d]{24}$/i;
export function id(value: unknown, label: string) {
  if (typeof value !== 'string' || !objectId.test(value)) throw new HttpError(400, `${label} is invalid`);
  return value;
}
// Cart lines: duplicates are merged, and prices are never read from the client.
export function cartItems(body: unknown) {
  bodyObject(body);
  if (!Array.isArray(body.items) || body.items.length === 0) throw new HttpError(400, 'Your cart is empty');
  if (body.items.length > 50) throw new HttpError(400, 'An order can contain at most 50 different products');
  const quantities = new Map<string, number>();
  for (const line of body.items) {
    if (!line || typeof line !== 'object') throw new HttpError(400, 'Each item needs a productId and quantity');
    const { productId, quantity } = line as Body;
    id(productId, 'productId');
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new HttpError(400, 'Quantities must be whole numbers from 1 to 999');
    quantities.set(productId as string, (quantities.get(productId as string) ?? 0) + quantity);
  }
  if ([...quantities.values()].some((quantity) => quantity > orderLimits.maxPerProduct)) throw new HttpError(400, `You can order up to ${orderLimits.maxPerProduct} of each product`);
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}
// The storefront's random ID for one checkout attempt (the Idempotency-Key header). Optional.
export function checkoutKey(value: unknown) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^[\w-]{16,100}$/.test(value)) throw new HttpError(400, 'Idempotency-Key must be 16 to 100 letters, numbers, dashes or underscores');
  return value;
}
export function newOrder(body: unknown) {
  const items = cartItems(body);
  const input = body as Body;
  const addressId = id(input.addressId, 'Delivery address');
  if (input.paymentMethod !== 'cash') throw new HttpError(400, 'Cash on delivery is the only payment method available right now');
  return { items, addressId, paymentMethod: 'cash' as const };
}
type Choice<T extends readonly string[]> = T[number];
function choice<T extends readonly string[]>(body: Body, key: string, options: T, message: string): Choice<T> {
  const value = body[key];
  if (typeof value !== 'string' || !options.includes(value)) throw new HttpError(400, message);
  return value as Choice<T>;
}
function region(body: Body) {
  const value = text(body, 'region', { required: true });
  if (!regions.includes(value)) throw new HttpError(400, 'Select a valid Ghana region');
  return value;
}
// Applicants must be adults; the upper bound only catches typos in the year.
function dateOfBirth(body: Body) {
  const raw = text(body, 'dateOfBirth', { required: true, max: 10 });
  const value = new Date(`${raw}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(value.getTime())) throw new HttpError(400, 'dateOfBirth must be a date such as 1995-04-21');
  const today = new Date();
  const age = today.getUTCFullYear() - value.getUTCFullYear() - (today < new Date(Date.UTC(today.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) ? 1 : 0);
  if (age < 18) throw new HttpError(400, 'Delivery partners must be at least 18 years old');
  if (age > 80) throw new HttpError(400, 'Please check the date of birth');
  return value;
}
function emergencyContact(body: Body, ownPhone?: string) {
  const name = text(body, 'emergencyContactName', { required: true });
  const contactPhone = phone(body, true, 'emergencyContactPhone');
  if (ownPhone && contactPhone.replace(/\D/g, '') === ownPhone.replace(/\D/g, '')) throw new HttpError(400, 'The emergency contact needs a different phone number from yours');
  return { name, phone: contactPhone };
}
// Everything an applicant fills in. Status, approval and review fields are never read from the body.
export function deliveryApplication(body: unknown) {
  bodyObject(body);
  const transportType = choice(body, 'transportType', TRANSPORT_TYPES, 'Choose a means of transport');
  const motorised = MOTORISED.includes(transportType);
  const ownPhone = phone(body, true);
  const fields = {
    fullName: text(body, 'fullName', { required: true }),
    email: email(body),
    phone: ownPhone,
    dateOfBirth: dateOfBirth(body),
    region: region(body),
    city: text(body, 'city', { required: true }),
    address: text(body, 'address', { required: true, max: 200 }),
    digitalAddress: text(body, 'digitalAddress', { max: 40 }).toUpperCase(),
    transportType,
    vehicleType: text(body, 'vehicleType', { required: motorised, max: 80 }),
    vehicleRegistration: text(body, 'vehicleRegistration', { required: motorised, max: 30 }).toUpperCase(),
    licenseNumber: text(body, 'licenseNumber', { required: motorised, max: 40 }).toUpperCase(),
    idType: choice(body, 'idType', ID_TYPES, 'Choose an ID type'),
    idNumber: text(body, 'idNumber', { required: true, max: 40 }).toUpperCase(),
    emergencyContact: emergencyContact(body, ownPhone),
    availability: choice(body, 'availability', AVAILABILITY, 'Choose when you are available'),
    notes: text(body, 'notes', { max: 500 }),
  };
  return fields;
}
// What an approved partner may change themselves. Identity, vehicle and status stay with management.
export function partnerProfile(body: unknown) {
  bodyObject(body);
  const fields: Record<string, unknown> = {};
  if (body.phone !== undefined) fields.phone = phone(body, true);
  if (body.region !== undefined) fields.region = region(body);
  if (body.city !== undefined) fields.city = text(body, 'city', { required: true });
  if (body.address !== undefined) fields.address = text(body, 'address', { required: true, max: 200 });
  if (body.digitalAddress !== undefined) fields.digitalAddress = text(body, 'digitalAddress', { max: 40 }).toUpperCase();
  if (body.availability !== undefined) fields.availability = choice(body, 'availability', AVAILABILITY, 'Choose when you are available');
  if (body.emergencyContactName !== undefined || body.emergencyContactPhone !== undefined) fields.emergencyContact = emergencyContact(body);
  if (!Object.keys(fields).length) throw new HttpError(400, 'Nothing to update');
  return fields;
}
export function review(body: unknown) {
  bodyObject(body);
  const rating = body.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Choose a rating from 1 to 5 stars');
  return { rating, comment: text(body, 'comment', { max: 1000 }) };
}
export function location(body: unknown) {
  bodyObject(body);
  const { lat, lng } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpError(400, 'lat and lng must be valid coordinates');
  return { lat, lng };
}
