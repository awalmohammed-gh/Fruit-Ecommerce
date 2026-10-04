import { useEffect, useMemo } from "react";
import { categoriesApi, labelFromSlug } from "../frontApisRoute/categories";
import type { Category } from "../types";
import { useResource } from "./useResource";

// Shared by the navbar, home page and shop filters, so the list is fetched once per page load.
let pending: ReturnType<typeof categoriesApi.list> | null = null;
export function invalidateStoreCategories() {
  pending = null;
  window.dispatchEvent(new Event("greenfarm:categories-changed"));
}
const loadCategories = () => {
  pending ??= categoriesApi.list().catch((error) => { pending = null; throw error; });
  return pending;
};

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
    window.addEventListener("greenfarm:categories-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("greenfarm:categories-changed", refresh);
      window.removeEventListener("focus", refresh);
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
