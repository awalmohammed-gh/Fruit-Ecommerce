import { apiRequest } from "./client";

// Storefront content managed from Admin → Settings: hero, banners, section text, ads and store details.

export interface HeroSlide {
  _id?: string;
  image: string; label: string; heading: string; highlight: string; description: string;
  primaryText: string; primaryLink: string; secondaryText: string; secondaryLink: string;
  active: boolean;
}
export interface Advert { active: boolean; label: string; title: string; description: string; points: string[]; ctaText: string; ctaLink: string; image: string }
export interface SectionHeading { eyebrow: string; heading: string; description: string }
export interface StoreInfo { description: string; address: string; phone: string; email: string }
export interface Announcement { active: boolean; message: string; secondary: string }
export interface HomeSections { features: { title: string; description: string }[]; categories: SectionHeading; popular: SectionHeading }
// favicon: empty for the built-in /favicon.svg.
export interface SeoSettings { siteName: string; defaultTitle: string; defaultDescription: string; socialImage: string; favicon: string }
export interface HeroSettings { mode: "single" | "slider"; autoplaySeconds: number; single: HeroSlide; slides: HeroSlide[] }

/** The admin's full copy, inactive parts included. */
export interface SiteContent {
  store: StoreInfo; announcement: Announcement; hero: HeroSettings; sections: HomeSections;
  ads: { partner: Advert; newsletter: Advert };
  seo: SeoSettings;
  updatedAt: string;
}
export type ContentBlock = "store" | "announcement" | "hero" | "sections" | "ads" | "seo";

export const PLACEMENTS = [
  { value: "home-top", label: "Homepage top", where: "Home page, under the store highlights" },
  { value: "home-middle", label: "Homepage middle", where: "Home page, after Popular picks" },
  { value: "home-bottom", label: "Homepage bottom", where: "Home page, above the deals section" },
  { value: "products", label: "Products page", where: "Top of the product list (all groceries)" },
  { value: "category", label: "Category page", where: "Top of the product list for a category" },
] as const;
export type Placement = typeof PLACEMENTS[number]["value"];
export const placementLabel = (value: Placement) => PLACEMENTS.find((placement) => placement.value === value)?.label ?? value;

export interface StoreBanner {
  _id: string; placement: Placement; category: string;
  badge: string; title: string; highlight: string; description: string; image: string; buttonText: string; buttonLink: string;
}
export interface AdminBanner extends StoreBanner {
  name: string; active: boolean; startsAt: string | null; endsAt: string | null; createdAt: string; updatedAt: string;
}
export type BannerInput = Omit<AdminBanner, "_id" | "createdAt" | "updatedAt">;

/** What shoppers see: only active, in-schedule content. */
export interface PublicContent {
  store: StoreInfo;
  announcement: Announcement | null;
  hero: { autoplaySeconds: number; slides: HeroSlide[] };
  sections: HomeSections;
  ads: { partner: Advert | null; newsletter: Advert | null };
  seo: SeoSettings;
  banners: StoreBanner[];
}

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const contentApi = {
  site: () => apiRequest<PublicContent>("/content"),
};

export const contentAdminApi = {
  get: () => apiRequest<{ content: SiteContent }>("/admin/content"),
  save: <K extends ContentBlock>(block: K, value: SiteContent[K]) =>
    apiRequest<{ message: string; content: SiteContent }>(`/admin/content/${block}`, json("PUT", value)),
  banners: () => apiRequest<{ banners: AdminBanner[] }>("/admin/banners"),
  createBanner: (input: BannerInput) => apiRequest<{ message: string; banner: AdminBanner }>("/admin/banners", json("POST", input)),
  updateBanner: (id: string, input: BannerInput) => apiRequest<{ message: string; banner: AdminBanner }>(`/admin/banners/${encodeURIComponent(id)}`, json("PUT", input)),
  setBannerActive: (id: string, active: boolean) => apiRequest<{ message: string; banner: AdminBanner }>(`/admin/banners/${encodeURIComponent(id)}/status`, json("PATCH", { active })),
  removeBanner: (id: string) => apiRequest<{ message: string }>(`/admin/banners/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
