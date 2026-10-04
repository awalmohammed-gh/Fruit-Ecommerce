import { apiRequest } from "./client";

// cover: the newest product image in the category, for categories without their own image.
export interface StoreCategory { _id: string; name: string; slug: string; image: string; description: string; isActive: boolean; seoTitle?: string; seoDescription?: string; seoImage?: string; cover: string; productCount: number; createdAt: string; updatedAt: string }
export interface UnlistedCategory { slug: string; productCount: number; cover: string }
export interface CategoryInput { name: string; slug?: string; image: string; description: string; isActive: boolean; seoTitle: string; seoDescription: string; seoImage: string }
type CategoryResponse = { category: StoreCategory; message?: string };

export const categoriesApi = {
  list: () => apiRequest<{ categories: StoreCategory[]; unlisted: UnlistedCategory[] }>("/categories"),
  manage: () => apiRequest<{ categories: StoreCategory[]; unlisted: UnlistedCategory[] }>("/categories/manage"),
  create: (input: CategoryInput) => apiRequest<CategoryResponse>("/categories", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Omit<CategoryInput, "slug">) =>
    apiRequest<CategoryResponse>(`/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => apiRequest<{ message: string }>(`/categories/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// Turns "dairy-eggs" into "Dairy Eggs" for slugs that have no category record yet.
export const labelFromSlug = (slug: string) => slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
