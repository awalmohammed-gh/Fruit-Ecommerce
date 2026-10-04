import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { LoaderCircleIcon, StarIcon } from "lucide-react";
import toast from "../toast/toast";
import { reviewsApi, type Review } from "../../frontApisRoute/reviews";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { useResource } from "../../hooks/useResource";

const Stars = ({ value, size = "size-4" }: { value: number; size?: string }) => (
  <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => <StarIcon key={star} aria-hidden="true" className={`${size} ${star <= Math.round(value) ? "text-app-warning fill-app-warning" : "text-app-border"}`} />)}
  </span>
);

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
const reviewDate = (value: string) => new Date(value).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });

// Customers who received the product can leave (or update) one review.
function ReviewForm({ productId, existing, onSaved }: { productId: string; existing: Review | null; onSaved: () => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rating || saving) return;
    setSaving(true);
    try {
      await reviewsApi.save(productId, rating, comment.trim());
      toast.success(existing ? "Your review was updated" : "Thanks for your review");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-app-border bg-white p-5 mb-8">
      <p className="text-sm font-semibold text-app-green">{existing ? "Update your review" : "You bought this. How was it?"}</p>
      <div className="flex items-center gap-1 mt-3" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => setRating(star)} className="p-1 rounded-md hover:bg-amber-50">
            <StarIcon className={`size-6 ${star <= rating ? "text-app-warning fill-app-warning" : "text-app-border"}`} aria-hidden="true" />
          </button>
        ))}
      </div>
      <label htmlFor="review-comment" className="sr-only">Your review</label>
      <textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} placeholder="What did you like? How was the freshness? (optional)"
        className="w-full mt-3 px-4 py-3 text-sm rounded-xl border border-app-border focus:border-app-green focus:ring-2 focus:ring-app-green/10 outline-none resize-y" />
      <button type="submit" disabled={!rating || saving} className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-app-green text-white text-sm font-semibold hover:bg-app-green-light disabled:opacity-50">
        {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}{existing ? "Update review" : "Post review"}
      </button>
    </form>
  );
}

export default function ReviewsSection({ productId, onChanged }: { productId: string; onChanged?: () => void }) {
  const { user } = useCustomerAuth();
  const location = useLocation();
  const [pages, setPages] = useState(1);
  const [version, setVersion] = useState(0);
  const isCustomer = !!user;
  const list = useResource(`reviews:${productId}:${pages}:${version}`, async () => {
    // Load every page shown so far, so "Show more" appends instead of replacing.
    const results = await Promise.all(Array.from({ length: pages }, (_, index) => reviewsApi.list(productId, index + 1)));
    return { ...results[results.length - 1]!, reviews: results.flatMap((result) => result.reviews) };
  });
  const mine = useResource(`my-review:${productId}:${isCustomer}:${version}`, () => (isCustomer ? reviewsApi.mine(productId) : Promise.resolve(null)));
  const summary = list.data?.summary;
  const maxCount = Math.max(1, ...Object.values(summary?.stars ?? {}));

  return (
    <section className="mt-10" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-2xl font-semibold text-app-green mb-6">Customer Reviews</h2>
      <div className="bg-white/50 rounded-2xl p-6 md:p-8">
        {mine.data?.canReview && <ReviewForm key={mine.data.review?._id ?? "new"} productId={productId} existing={mine.data.review} onSaved={() => { setVersion((value) => value + 1); onChanged?.(); }} />}

        {list.error ? (
          <div role="alert" className="text-sm text-red-700">{list.error} <button type="button" onClick={list.reload} className="underline">Try again</button></div>
        ) : !summary ? (
          <p role="status" className="text-sm text-app-text-light">Loading reviews…</p>
        ) : summary.count === 0 ? (
          <p className="text-sm text-app-text-light">
            No reviews yet. Reviews come from customers who have received this product.
            {!user && <> <Link to="/login" state={{ from: location.pathname + location.search }} className="text-app-green font-semibold hover:underline">Sign in</Link> to review your past orders.</>}
          </p>
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-8 mb-8 pb-8 border-b border-app-border">
              <div className="flex-center flex-col md:min-w-[160px] lg:w-1/3">
                <span className="text-5xl font-semibold text-app-green">{summary.average.toFixed(1)}</span>
                <div className="mt-2 mb-1"><Stars value={summary.average} /></div>
                <span className="text-sm text-zinc-600">{summary.count} review{summary.count === 1 ? "" : "s"}</span>
              </div>
              <div className="flex-1 space-y-2">
                {([5, 4, 3, 2, 1] as const).map((star) => (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-600 w-8 text-right">{star} ★</span>
                    <div className="flex-1 h-2.5 bg-app-border rounded-full overflow-hidden">
                      <div className="h-full bg-app-warning rounded-full transition-all duration-500" style={{ width: `${(summary.stars[star] / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-xs text-zinc-600 w-6">{summary.stars[star]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              {list.data!.reviews.map((review) => (
                <div key={review._id} className="flex gap-4">
                  <div className="size-10 rounded-full bg-app-green/10 text-app-green flex-center shrink-0 text-sm font-semibold" aria-hidden="true">{initials(review.authorName)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="text-sm font-semibold text-app-text">{review.authorName}</span>
                      <span className="text-xs text-zinc-600">·</span>
                      <span className="text-xs text-zinc-600">{reviewDate(review.createdAt)}</span>
                      <span className="text-xs text-app-green">· Verified purchase</span>
                    </div>
                    <div className="mb-2"><Stars value={review.rating} size="size-3.5" /></div>
                    {review.comment && <p className="text-sm text-zinc-600 leading-relaxed">{review.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
            {list.data!.pagination.page < list.data!.pagination.totalPages && (
              <button type="button" onClick={() => setPages((value) => value + 1)} disabled={list.loading} className="mt-6 px-5 py-2.5 rounded-full border border-app-border text-sm font-semibold text-app-green hover:bg-green-50 disabled:opacity-50">
                {list.loading ? "Loading…" : "Show more reviews"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
