import { useSyncExternalStore } from "react";
import { contentApi, type PublicContent } from "../frontApisRoute/content";

// The storefront's admin-managed content (hero, banners, section text, store details), shared by every
// component that shows part of it: one request per page load.
// The backend owns these settings. Share the fetched copy in memory for this page visit only.
interface State { data: PublicContent | null; error: string | null }

let state: State = { data: null, error: null };
let requested = false;
// Set after an admin save: the next request skips the CDN's shared copy, so the admin sees the change at once.
let bypassCache = false;
const listeners = new Set<() => void>();
const publish = (next: State) => { state = next; listeners.forEach((listener) => listener()); };

function load() {
  if (requested) return;
  requested = true;
  const fresh = bypassCache;
  bypassCache = false;
  contentApi.site(fresh).then(
    (data) => {
      publish({ data, error: null });
    },
    (error: unknown) => {
      requested = false;
      bypassCache ||= fresh;
      publish({ data: state.data, error: error instanceof Error ? error.message : "Unable to load the store content" });
    },
  );
}

// After the admin saves, so the store pages in this tab show the new content.
export function refreshSiteContent() {
  requested = false;
  bypassCache = true;
  if (listeners.size) load();
}

export function useSiteContent() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    load();
    return () => listeners.delete(listener);
  }, () => state, () => state);
}
