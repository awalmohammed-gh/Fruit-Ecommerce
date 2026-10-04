import { useMemo } from "react";
import { categoriesApi, labelFromSlug } from "../../../frontApisRoute/categories";
import { useResource } from "../../../hooks/useResource";

// Category names for filters, forms and table cells. Slugs without a record still get a readable label.
export function useCategories() {
  const resource = useResource("categories", () => categoriesApi.manage());
  const { data } = resource;
  const names = useMemo(() => {
    const map = new Map<string, string>();
    data?.categories.forEach((category) => map.set(category.slug, category.name));
    return map;
  }, [data]);
  const options = useMemo(() => [
    ...(data?.categories.map((category) => ({ value: category.slug, label: category.name })) ?? []),
    ...(data?.unlisted.map((category) => ({ value: category.slug, label: `${labelFromSlug(category.slug)} (no category record)` })) ?? []),
  ], [data]);
  return { ...resource, options, nameOf: (slug: string) => names.get(slug) ?? labelFromSlug(slug) };
}

// Mirrors the server's calculation so forms can preview it; the server's value is what gets saved.
export function discountPreview(price: number, originalPrice: number) {
  if (!(originalPrice > price) || !Number.isFinite(price)) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}
