import { lazy, type ComponentType } from "react";

/**
 * A route component whose code is downloaded the first time it's needed, so a shopper opening the home page
 * never downloads the admin dashboard, the delivery partner area or the map library.
 * `preload()` starts that download early (e.g. while the browser is idle) so the first visit feels instant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  let pending: Promise<{ default: T }> | undefined;
  const preload = () => (pending ??= load().catch((error: unknown) => { pending = undefined; throw error; }));
  return Object.assign(lazy(preload), { preload });
}

/**
 * Runs `task` a little after the page has loaded, when the browser has a quiet moment. The load event comes before
 * the hero picture and the content pictures (they start once the content has arrived), so the extra wait keeps
 * this background work from taking bandwidth they need on a slow connection.
 */
export function whenIdle(task: () => void, afterLoadMs = 4000) {
  const run = () => setTimeout(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(task, { timeout: 5000 });
    else task();
  }, afterLoadMs);
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}
