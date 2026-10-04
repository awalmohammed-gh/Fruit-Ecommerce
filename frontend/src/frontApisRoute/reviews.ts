import { apiRequest } from "./client";
import type { Pagination } from "./products";

export interface Review { _id: string; product: string; authorName: string; rating: number; comment: string; createdAt: string; updatedAt: string }
export interface ReviewSummary { average: number; count: number; stars: Record<"1" | "2" | "3" | "4" | "5", number> }

export const reviewsApi = {
  list: (productId: string, page = 1) =>
    apiRequest<{ reviews: Review[]; summary: ReviewSummary; pagination: Pagination }>(`/products/${encodeURIComponent(productId)}/reviews?page=${page}`),
  // Whether the signed-in customer has received the product, and their own review.
  mine: (productId: string) => apiRequest<{ canReview: boolean; review: Review | null }>(`/products/${encodeURIComponent(productId)}/reviews/mine`),
  save: (productId: string, rating: number, comment: string) =>
    apiRequest<{ review: Review; message: string }>(`/products/${encodeURIComponent(productId)}/reviews`, { method: "POST", body: JSON.stringify({ rating, comment }) }),
};
