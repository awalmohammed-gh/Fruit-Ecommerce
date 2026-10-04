import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { siteContent } from './content.js';

// Search-engine and sharing metadata for every storefront address, built from the database.
// One place decides each page's title, description, canonical URL, robots rule, sharing tags and
// structured data. The storefront asks for it on every navigation (GET /api/seo), and the server
// writes the same tags into the HTML it serves, so crawlers that don't run JavaScript see them too.

export interface HeadTag { tag: 'meta' | 'link'; attributes: Record<string, string> }
export interface PageMeta {
  /** 404 when the address doesn't exist (unknown page, deleted product, disabled category). */
  status: 200 | 404;
  title: string;
  robots: string;
  tags: HeadTag[];
  jsonLd: object[];
}

type Query = Record<string, unknown>;
type Content = Awaited<ReturnType<typeof siteContent>>;

interface Page {
  status?: 200 | 404;
  title: string;
  description: string;
  /** Path on this site, e.g. "/products/cheese-200g"; null for pages that shouldn't be indexed. */
  canonical: string | null;
  robots?: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'product';
  price?: number;
  jsonLd?: object[];
}

// Private areas: never indexed, and links on them aren't followed either. Authentication still protects them.
const PRIVATE: [RegExp, string][] = [
  [/^\/login$/, 'Sign in'],
  [/^\/cart$/, 'Your cart'],
  [/^\/checkout$/, 'Checkout'],
  [/^\/account$/, 'My account'],
  [/^\/my-orders(\/.*)?$/, 'My orders'],
  [/^\/my-address$/, 'Saved addresses'],
  [/^\/admin(\/.*)?$/, 'GreenFarm Management'],
  [/^\/delivery-partner(\/(?!apply$).*)?$/, 'Delivery partner'],
  [/^\/delivery(\/.*)?$/, 'Delivery partner'],
];

const one = (query: Query, key: string) => (typeof query[key] === 'string' ? (query[key] as string).trim() : '');

/** Plain text of at most `max` characters, cut at a word. */
export function summary(text: string, max = 155) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–-]+$/, '')}…`;
}

const labelFromSlug = (slug: string) => slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

function pageNumber(query: Query) {
  const value = Number(one(query, 'page') || 1);
  return Number.isInteger(value) && value > 1 ? value : 1;
}

function breadcrumbs(siteUrl: string, items: [string, string][]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: `${siteUrl}${path}` })),
  };
}

async function productPage(key: string, siteUrl: string, siteName: string): Promise<Page | null> {
  const product = mongoose.isObjectIdOrHexString(key) ? await Product.findById(key).lean() : await Product.findOne({ slug: key.toLowerCase() }).lean();
  if (!product) return null;
  // Only a public category gets a breadcrumb link; otherwise the trail goes through the shop.
  const category = await Category.findOne({ slug: product.category, isActive: { $ne: false } }).select('name').lean();
  const categoryName = category?.name ?? labelFromSlug(product.category);
  const parent: [string, string] = category ? [category.name, `/category/${product.category}`] : ['Shop', '/products'];
  const path = `/products/${product.slug ?? product._id}`;
  const description = product.seoDescription || summary(product.description);
  const inStock = product.stock > 0;
  return {
    title: product.seoTitle || `${product.name} | ${siteName}`,
    description,
    canonical: path,
    image: product.image,
    imageAlt: `${product.name} product image`,
    type: 'product',
    price: product.price,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Product',
        name: product.name,
        image: [product.image],
        description: summary(product.description, 5000),
        sku: String(product._id),
        category: categoryName,
        url: `${siteUrl}${path}`,
        offers: {
          '@type': 'Offer',
          url: `${siteUrl}${path}`,
          priceCurrency: 'GHS',
          price: product.price.toFixed(2),
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: siteName },
        },
        // Only real reviews: a product nobody has reviewed gets no rating at all.
        ...(product.reviewCount > 0 && {
          aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount, bestRating: 5, worstRating: 1 },
        }),
      },
      breadcrumbs(siteUrl, [['Home', '/'], parent, [product.name, path]]),
    ],
  };
}

async function categoryPage(slug: string, query: Query, siteUrl: string, content: Content): Promise<Page | null> {
  const category = await Category.findOne({ slug: slug.toLowerCase(), isActive: { $ne: false } }).lean();
  if (!category) return null;
  const { siteName, defaultDescription, socialImage } = content.seo!;
  const page = pageNumber(query);
  const filtered = Object.keys(query).some((key) => key !== 'page');
  const path = `/category/${category.slug}`;
  const products = await Product.find({ category: category.slug }).sort({ createdAt: -1, _id: -1 }).limit(12).select('name slug').lean();
  const title = category.seoTitle || `${category.name} | ${siteName}`;
  return {
    title: page > 1 ? `${title} – page ${page}` : title,
    description: category.seoDescription || summary(category.description || `Shop ${category.name} at ${siteName}. ${defaultDescription}`),
    // Filtered or sorted views point at the plain category page; page 2, 3, ... are pages of their own.
    canonical: page > 1 && !filtered ? `${path}?page=${page}` : path,
    robots: filtered ? 'noindex,follow' : 'index,follow',
    image: category.seoImage || category.image || socialImage!,
    imageAlt: `${category.name} category`,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: category.name,
        description: category.description || undefined,
        url: `${siteUrl}${path}`,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: products.map((product, index) => ({ '@type': 'ListItem', position: index + 1, name: product.name, url: `${siteUrl}/products/${product.slug ?? product._id}` })),
        },
      },
      breadcrumbs(siteUrl, [['Home', '/'], ['Shop', '/products'], [category.name, path]]),
    ],
  };
}

function homePage(siteUrl: string, content: Content): Page {
  const { siteName, defaultTitle, defaultDescription, socialImage } = content.seo!;
  const store = content.store!;
  return {
    title: defaultTitle!,
    description: defaultDescription!,
    canonical: '/',
    image: socialImage!,
    imageAlt: siteName!,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Organization',
        name: siteName, url: `${siteUrl}/`, logo: `${siteUrl}/favicon.svg`,
        ...(store.description && { description: store.description }),
        ...(store.email && { email: store.email }),
        ...(store.phone && { telephone: store.phone }),
        ...(store.address && { address: { '@type': 'PostalAddress', streetAddress: store.address, addressCountry: 'GH' } }),
      },
      {
        '@context': 'https://schema.org', '@type': 'WebSite',
        name: siteName, url: `${siteUrl}/`,
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
      },
    ],
  };
}

async function describe(path: string, query: Query, siteUrl: string, content: Content): Promise<Page> {
  const { siteName, defaultDescription, socialImage } = content.seo!;
  const named = (title: string) => `${title} | ${siteName}`;

  const privatePage = PRIVATE.find(([pattern]) => pattern.test(path));
  if (privatePage) return { title: named(privatePage[1]), description: defaultDescription!, canonical: null, robots: 'noindex,nofollow' };

  if (path === '/') return homePage(siteUrl, content);

  if (path === '/products') {
    // The old category filter address is a duplicate of /category/:slug.
    const category = one(query, 'category');
    if (category) return { ...(await categoryPage(category, {}, siteUrl, content) ?? { title: named('Shop'), description: defaultDescription!, image: socialImage! }), canonical: `/category/${category}`, robots: 'noindex,follow' };
    const page = pageNumber(query);
    const filtered = Object.keys(query).some((key) => key !== 'page');
    const [total, categories] = await Promise.all([
      Product.countDocuments(),
      Category.find({ isActive: { $ne: false } }).sort({ name: 1 }).select('name').lean(),
    ]);
    const names = categories.map((item) => item.name);
    return {
      title: named(page > 1 ? `Shop all groceries – page ${page}` : 'Shop all groceries'),
      description: summary(`Browse ${total} groceries at ${siteName}${names.length ? `: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ' and more' : ''}` : ''}. ${defaultDescription}`),
      canonical: page > 1 && !filtered ? `/products?page=${page}` : '/products',
      robots: filtered ? 'noindex,follow' : 'index,follow',
      image: socialImage!,
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Shop all groceries', url: `${siteUrl}/products` },
        breadcrumbs(siteUrl, [['Home', '/'], ['Shop', '/products']]),
      ],
    };
  }

  const product = /^\/products\/([^/]+)$/.exec(path);
  if (product) return (await productPage(decodeURIComponent(product[1]!), siteUrl, siteName!)) ?? notFound(named, defaultDescription!);

  const category = /^\/category\/([^/]+)$/.exec(path);
  if (category) return (await categoryPage(decodeURIComponent(category[1]!), query, siteUrl, content)) ?? notFound(named, defaultDescription!);

  if (path === '/deals') {
    const onSale = await Product.countDocuments({ discount: { $gt: 0 } });
    return {
      title: named('Deals and discounts'),
      description: summary(`${onSale ? `${onSale} groceries on offer right now` : 'This week’s offers'} at ${siteName}. ${defaultDescription}`),
      canonical: '/deals',
      image: socialImage!,
      jsonLd: [breadcrumbs(siteUrl, [['Home', '/'], ['Deals', '/deals']])],
    };
  }

  // Internal search results: followed for their links, but never indexed.
  if (path === '/search') {
    const q = one(query, 'q');
    return { title: named(q ? `Search results for “${summary(q, 60)}”` : 'Search'), description: defaultDescription!, canonical: null, robots: 'noindex,follow' };
  }

  if (path === '/delivery-partner/apply') {
    const partner = content.ads!.partner!;
    return {
      title: named('Become a delivery partner'),
      description: summary(partner.description || `Deliver groceries with ${siteName} on a schedule that works for you.`),
      canonical: '/delivery-partner/apply',
      image: socialImage!,
    };
  }

  return notFound(named, defaultDescription!);
}

const notFound = (named: (title: string) => string, description: string): Page =>
  ({ status: 404, title: named('Page not found'), description, canonical: null, robots: 'noindex,nofollow' });

/** Metadata for one storefront address, e.g. ("/products/cheese-200g", {}). */
export async function pageMeta(rawPath: string, query: Query, siteUrl: string): Promise<PageMeta> {
  const path = rawPath.replace(/\/+$/, '') || '/';
  const content = await siteContent();
  const page = await describe(path, query, siteUrl, content);
  const siteName = content.seo!.siteName!;
  const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`);
  const robots = page.robots ?? 'index,follow';
  const meta = (key: 'name' | 'property', name: string, value: string | undefined): HeadTag[] => (value ? [{ tag: 'meta', attributes: { [key]: name, content: value } }] : []);
  const image = page.image ? absolute(page.image) : undefined;
  const url = page.canonical ? absolute(page.canonical) : undefined;
  const tags: HeadTag[] = [
    ...meta('name', 'description', page.description),
    ...meta('name', 'robots', robots),
    ...(url ? [{ tag: 'link' as const, attributes: { rel: 'canonical', href: url } }] : []),
    ...meta('property', 'og:site_name', siteName),
    ...meta('property', 'og:locale', 'en_GH'),
    ...meta('property', 'og:type', page.type ?? 'website'),
    ...meta('property', 'og:title', page.title),
    ...meta('property', 'og:description', page.description),
    ...meta('property', 'og:url', url),
    ...meta('property', 'og:image', image),
    ...meta('property', 'og:image:alt', image ? page.imageAlt ?? page.title : undefined),
    ...meta('property', 'product:price:amount', page.price?.toFixed(2)),
    ...meta('property', 'product:price:currency', page.price !== undefined ? 'GHS' : undefined),
    ...meta('name', 'twitter:card', image ? 'summary_large_image' : 'summary'),
    ...meta('name', 'twitter:title', page.title),
    ...meta('name', 'twitter:description', page.description),
    ...meta('name', 'twitter:image', image),
    ...meta('name', 'twitter:image:alt', image ? page.imageAlt ?? page.title : undefined),
  ];
  return { status: page.status ?? 200, title: page.title, robots, tags, jsonLd: page.jsonLd ?? [] };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
// Admin-entered text ends up inside <script>; escaping "<" keeps it from closing the tag.
export const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** The same tags as HTML, for pages the server sends. Every tag carries data-seo so the storefront can replace them. */
export function renderHead(meta: PageMeta) {
  const tags = meta.tags.map(({ tag, attributes }) =>
    `<${tag} data-seo ${Object.entries(attributes).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ')}>`);
  const scripts = meta.jsonLd.map((data) => `<script data-seo type="application/ld+json">${jsonForScript(data)}</script>`);
  return [`<title>${escapeHtml(meta.title)}</title>`, ...tags, ...scripts].join('\n    ');
}
