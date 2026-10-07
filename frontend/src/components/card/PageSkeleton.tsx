/**
 * Shown in the page area while a page's code downloads; the store header and footer stay in place.
 * Same shapes and colours as the product grid placeholders, so the page settles without a jump.
 */
const PageSkeleton = () => (
  <div role="status" aria-label="Loading" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 min-h-[calc(100dvh-9rem)]">
    <div className="h-9 w-56 max-w-full rounded-xl bg-white border border-app-border animate-pulse" aria-hidden="true" />
    <div className="mt-3 h-4 w-80 max-w-full rounded-lg bg-white border border-app-border animate-pulse" aria-hidden="true" />
    <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[3/4] rounded-2xl bg-white border border-app-border animate-pulse" />)}
    </div>
  </div>
);

export default PageSkeleton;
