import { useSyncExternalStore } from "react";
import { contentApi, type PublicContent } from "../frontApisRoute/content";

// The storefront's admin-managed content (hero, banners, section text, store details), shared by every
// component that shows part of it: one request per page load.
// The last copy is kept in this browser so the announcement bar and hero appear straight away on the
// next visit instead of popping in; the fresh copy from the server replaces it as soon as it arrives.
const KEY = "greenfarm.content";
interface State { data: PublicContent | null; error: string | null }

function remembered(): PublicContent | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null") as PublicContent | null; } catch { return null; }
}

let state: State = { data: remembered(), error: null };
let requested = false;
const listeners = new Set<() => void>();
const publish = (next: State) => { state = next; listeners.forEach((listener) => listener()); };

function load() {
  if (requested) return;
  requested = true;
  contentApi.site().then(
    (data) => {
      publish({ data, error: null });
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
    },
    (error: unknown) => {
      requested = false;
      publish({ data: state.data, error: error instanceof Error ? error.message : "Unable to load the store content" });
    },
  );
}

// After the admin saves, so the store pages in this tab show the new content.
export function refreshSiteContent() {
  requested = false;
  if (listeners.size) load();
}

export function useSiteContent() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    load();
    return () => listeners.delete(listener);
  }, () => state, () => state);
}
