import { HttpError } from './errors.js';
import { bodyObject, text } from './validate.js';
import { categorySlug } from '../models/Product.js';
import { PLACEMENTS, type Placement } from '../models/Banner.js';

// Checks for Admin → Settings content. Each function takes one block from the request and returns
// the clean value that replaces it.
type Body = Record<string, unknown>;

function object(value: unknown, name: string): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, `${name} must be an object`);
  return value as Body;
}

function flag(body: Body, key: string, fallback: boolean) {
  const value = body[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new HttpError(400, `${key} must be true or false`);
  return value;
}

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch { return false; }
}
// A page on this site ("/products", "/products?category=dairy-eggs"), a home page section ("#categories") or a web address.
const sitePath = (value: string) => value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/\s/.test(value);

function link(body: Body, key: string, label: string) {
  const value = text(body, key, { max: 300 });
  if (value && !sitePath(value) && !/^#[\w-]+$/.test(value) && !isWebUrl(value))
    throw new HttpError(400, `${label} must be a page on this site (e.g. /products), a section like #categories, or a web address`);
  return value;
}

// Uploaded images are HTTPS URLs; the starting images are files on this site ("/content/...").
function image(body: Body, key: string, label: string) {
  const value = text(body, key, { max: 2048 });
  if (value && !sitePath(value) && !(isWebUrl(value) && value.startsWith('https:')))
    throw new HttpError(400, `${label} must be an uploaded image or an HTTPS image URL`);
  return value;
}

// A button needs both its text and where it goes, or neither.
function button(body: Body, textKey: string, linkKey: string, label: string) {
  const words = text(body, textKey, { max: 30 });
  const target = link(body, linkKey, `${label} link`);
  if (Boolean(words) !== Boolean(target)) throw new HttpError(400, `${label} needs both its text and its link`);
  return [words, target] as const;
}

function slide(value: unknown, name: string) {
  const body = object(value, name);
  const active = flag(body, 'active', true);
  const [primaryText, primaryLink] = button(body, 'primaryText', 'primaryLink', `${name} main button`);
  const [secondaryText, secondaryLink] = button(body, 'secondaryText', 'secondaryLink', `${name} second button`);
  const fields = {
    image: image(body, 'image', `${name} image`),
    label: text(body, 'label', { max: 60 }),
    heading: text(body, 'heading', { max: 90 }),
    highlight: text(body, 'highlight', { max: 60 }),
    description: text(body, 'description', { max: 240 }),
    primaryText, primaryLink, secondaryText, secondaryLink, active,
  };
  if (active && !fields.heading) throw new HttpError(400, `${name} needs a heading`);
  if (active && !fields.image) throw new HttpError(400, `${name} needs an image`);
  return fields;
}

export const MAX_SLIDES = 6;

export function hero(value: unknown) {
  const body = object(value, 'hero');
  if (body.mode !== 'single' && body.mode !== 'slider') throw new HttpError(400, 'Choose Single hero or Hero slider');
  const seconds = body.autoplaySeconds ?? 6;
  if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < 0 || seconds > 30)
    throw new HttpError(400, 'Time per slide must be between 0 (off) and 30 seconds');
  if (!Array.isArray(body.slides)) throw new HttpError(400, 'slides must be a list');
  if (body.slides.length > MAX_SLIDES) throw new HttpError(400, `The slider can have at most ${MAX_SLIDES} slides`);
  return {
    mode: body.mode,
    autoplaySeconds: seconds,
    single: slide(body.single, 'The hero'),
    slides: body.slides.map((entry, index) => slide(entry, `Slide ${index + 1}`)),
  };
}

export function store(value: unknown) {
  const body = object(value, 'store');
  const email = text(body, 'email', { max: 254 }).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Please enter a valid email address');
  const phone = text(body, 'phone', { max: 25 });
  if (phone && !/^[+\d\s().-]{7,25}$/.test(phone)) throw new HttpError(400, 'Please enter a valid phone number');
  return { description: text(body, 'description', { max: 300 }), address: text(body, 'address', { max: 160 }), phone, email };
}

export function announcement(value: unknown) {
  const body = object(value, 'announcement');
  const fields = { active: flag(body, 'active', true), message: text(body, 'message', { max: 90 }), secondary: text(body, 'secondary', { max: 90 }) };
  if (fields.active && !fields.message) throw new HttpError(400, 'The announcement needs a message');
  return fields;
}

function heading(value: unknown, name: string) {
  const body = object(value, name);
  return { eyebrow: text(body, 'eyebrow', { max: 60 }), heading: text(body, 'heading', { required: true, max: 80 }), description: text(body, 'description', { max: 200 }) };
}

export function sections(value: unknown) {
  const body = object(value, 'sections');
  // The four highlights under the hero each have a fixed icon, so there are always four.
  if (!Array.isArray(body.features) || body.features.length !== 4) throw new HttpError(400, 'There must be exactly four store highlights');
  return {
    features: body.features.map((entry, index) => {
      const item = object(entry, `Highlight ${index + 1}`);
      return { title: text(item, 'title', { required: true, max: 40 }), description: text(item, 'description', { max: 80 }) };
    }),
    categories: heading(body.categories, 'categories'),
    popular: heading(body.popular, 'popular'),
  };
}

function advert(value: unknown, name: string) {
  const body = object(value, name);
  const active = flag(body, 'active', true);
  const [ctaText, ctaLink] = button(body, 'ctaText', 'ctaLink', `${name} button`);
  const points = body.points ?? [];
  if (!Array.isArray(points) || points.length > 4) throw new HttpError(400, `${name} can list at most four points`);
  const fields = {
    active,
    label: text(body, 'label', { max: 60 }),
    title: text(body, 'title', { max: 90 }),
    description: text(body, 'description', { max: 300 }),
    points: points.map((point) => {
      if (typeof point !== 'string' || !point.trim() || point.trim().length > 60) throw new HttpError(400, `Each point in ${name.toLowerCase()} must be 1 to 60 characters`);
      return point.trim();
    }),
    ctaText, ctaLink,
    image: image(body, 'image', `${name} image`),
  };
  if (active && !fields.title) throw new HttpError(400, `${name} needs a title`);
  return fields;
}

// Search and sharing defaults. Site name and default title are required; the image falls back to none.
export function seo(value: unknown) {
  const body = object(value, 'seo');
  return {
    siteName: text(body, 'siteName', { required: true, max: 60 }),
    defaultTitle: text(body, 'defaultTitle', { required: true, max: 70 }),
    defaultDescription: text(body, 'defaultDescription', { required: true, max: 160 }),
    socialImage: image(body, 'socialImage', 'Sharing image'),
  };
}

export function ads(value: unknown) {
  const body = object(value, 'ads');
  return { partner: advert(body.partner, 'The delivery partner section'), newsletter: advert(body.newsletter, 'The deals section') };
}

function date(body: Body, key: string, label: string) {
  const value = body[key];
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) throw new HttpError(400, `${label} must be a valid date`);
  return parsed;
}

export function banner(value: unknown) {
  bodyObject(value);
  const body = value;
  if (typeof body.placement !== 'string' || !PLACEMENTS.includes(body.placement as Placement)) throw new HttpError(400, 'Choose where the banner appears');
  const placement = body.placement as Placement;
  const category = placement === 'category' ? text(body, 'category', { max: 60 }) : '';
  if (category && !categorySlug.test(category)) throw new HttpError(400, 'Choose a valid category');
  const [buttonText, buttonLink] = button(body, 'buttonText', 'buttonLink', 'The button');
  const startsAt = date(body, 'startsAt', 'Start date');
  const endsAt = date(body, 'endsAt', 'End date');
  if (startsAt && endsAt && endsAt <= startsAt) throw new HttpError(400, 'The end date must be after the start date');
  return {
    name: text(body, 'name', { required: true, max: 80 }),
    placement, category,
    badge: text(body, 'badge', { max: 40 }),
    title: text(body, 'title', { required: true, max: 90 }),
    highlight: text(body, 'highlight', { max: 60 }),
    description: text(body, 'description', { max: 240 }),
    image: image(body, 'image', 'Banner image'),
    buttonText, buttonLink,
    active: flag(body, 'active', false),
    startsAt, endsAt,
  };
}
