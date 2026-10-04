interface LoadingProps {
  /** What is loading, e.g. "Loading your orders". */
  label?: string;
  /** Pages without the store header (sign-in): centre on the whole screen. */
  fullScreen?: boolean;
  /** Inside a workspace content area: fill that area and centre there. */
  fill?: boolean;
}

/**
 * A centred spinner. By default it fills the visible page below the store header, so it sits in the
 * middle of the screen rather than near the top.
 */
const Loading = ({ label = "Loading", fullScreen = false, fill = false }: LoadingProps) => {
  const size = fullScreen ? "min-h-dvh bg-app-cream" : fill ? "flex-1 w-full" : "min-h-[calc(100dvh-9rem)]";
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 px-6 text-center ${size}`}>
      <span className="size-12 border-4 border-app-green/20 border-t-app-green rounded-full animate-spin" aria-hidden="true" />
      <p className="text-app-text-light text-sm">{label}…</p>
    </div>
  );
};

export default Loading;
