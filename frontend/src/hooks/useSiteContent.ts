import { useSyncExternalStore } from "react";
import { contentApi, type PublicContent } from "../frontApisRoute/content";

// The storefront's admin-managed content (hero, banners, section text, store details), shared by every
// component that shows part of it: one request per page load.
// The backend owns these settings. Share the fetched copy in memory for this page visit only.
interface State { data: PublicContent | null; error: string | null }

let state: State = { data: null, error: null };
let requested = false;
const listeners = new Set<() => void>();
const publish = (next: State) => { state = next; listeners.forEach((listener) => listener()); };

function load() {
  if (requested) return;
  requested = true;
  contentApi.site().then(
    (data) => {
      publish({ data, error: null });
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
