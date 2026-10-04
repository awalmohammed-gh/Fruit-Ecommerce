import { apiRequest } from "./client";

// Search-engine and sharing metadata for a storefront address, worked out by the server from the database.
export interface HeadTag { tag: "meta" | "link"; attributes: Record<string, string> }
export interface PageMeta { status: 200 | 404; title: string; robots: string; tags: HeadTag[]; jsonLd: object[] }

export const seoApi = {
  page: (path: string) => apiRequest<PageMeta>(`/seo?path=${encodeURIComponent(path)}`),
};
