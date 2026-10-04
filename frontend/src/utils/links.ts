// Storefront addresses, in one place so every link uses the readable, indexable form.

/** /products/cheese-200g (or the ID for products saved in an old cart before slugs existed). */
export const productPath = (product: { _id: string; slug?: string | undefined }) => `/products/${product.slug || product._id}`;

/** /category/dairy-eggs */
export const categoryPath = (slug: string) => `/category/${slug}`;

/**
 * A smaller copy of an uploaded image for the size it is shown at. Cloudinary resizes on request
 * (and serves WebP/AVIF where the browser supports it); other image hosts are returned unchanged.
 */
export function sizedImage(url: string, width: number) {
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) return url;
  return url.replace(marker, `${marker}f_auto,q_auto,c_limit,w_${width}/`);
}
