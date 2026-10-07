import { useEffect, useMemo } from "react";
import { categoriesApi, labelFromSlug } from "../frontApisRoute/categories";
import type { Category } from "../types";
import { useResource } from "./useResource";

// Shared by the navbar, home page and shop filters, so the list is fetched once per page load.
let pending: ReturnType<typeof categoriesApi.list> | null = null;
let loadedAt = 0;
// Set after an admin change: the next request skips the CDN's shared copy, so the admin sees it at once.
let bypassCache = false;
export function invalidateStoreCategories() {
  pending = null;
  bypassCache = true;
  window.dispatchEvent(new Event("greenfarm:categories-changed"));
}
const loadCategories = () => {
  if (!pending) {
    const fresh = bypassCache;
    bypassCache = false;
    pending = categoriesApi.list(fresh).then((result) => { loadedAt = Date.now(); return result; }, (error) => { pending = null; bypassCache ||= fresh; throw error; });
  }
  return pending;
};
// Coming back to the tab re-checks the list (or retries a failed load), but not more than once a minute,
// the lifetime of the CDN's copy.
const REFOCUS_INTERVAL_MS = 60_000;

export interface ShopCategory extends Category { productCount: number; description: string }

/**
 * Active category records, including ones with no products yet. Management-only repair data stays private.
 * Each has its own image, or a product photo as a fallback, or none.
 */
export function useStoreCategories() {
  const resource = useResource("store-categories", loadCategories);
  const { reload } = resource;
  useEffect(() => {
    const refresh = () => { pending = null; reload(); };
    const refocus = () => { if (Date.now() - loadedAt > REFOCUS_INTERVAL_MS) refresh(); };
    window.addEventListener("greenfarm:categories-changed", refresh);
    window.addEventListener("focus", refocus);
    return () => {
      window.removeEventListener("greenfarm:categories-changed", refresh);
      window.removeEventListener("focus", refocus);
    };
  }, [reload]);
  const categories = useMemo<ShopCategory[]>(() => {
    if (!resource.data) return [];
    const { categories: named } = resource.data;
    return [
      ...named.map((category) => ({ slug: category.slug, name: category.name, description: category.description, image: category.image || category.cover, productCount: category.productCount })),
    ];
  }, [resource.data]);
  return { ...resource, categories, nameOf: (slug: string) => categories.find((category) => category.slug === slug)?.name ?? labelFromSlug(slug) };
}
