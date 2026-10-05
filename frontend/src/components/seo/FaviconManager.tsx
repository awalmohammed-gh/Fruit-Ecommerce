import { useEffect } from "react";
import { useSiteContent } from "../../hooks/useSiteContent";

// The built-in icon from index.html: shown until the saved favicon is known, and whenever none is saved.
const FALLBACK = "/favicon.svg";

// Puts the favicon saved in Admin → Settings → Search & sharing in the browser tab, on every page.
// Each page load asks the backend for the site settings once; the built-in icon shows until they arrive.
// After the admin saves, the settings are fetched again, so the new icon appears straight away.
export default function FaviconManager() {
  const { data } = useSiteContent();
  const href = data?.seo?.favicon || FALLBACK;
  useEffect(() => {
    const current = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (current?.getAttribute("href") === href) return;
    // A new element rather than a new href: some browsers only notice a favicon change that way.
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = href;
    // The fallback is an SVG; a saved favicon can be any image type, which the browser works out itself.
    if (href === FALLBACK) link.type = "image/svg+xml";
    if (current) current.replaceWith(link);
    else document.head.appendChild(link);
  }, [href]);
  return null;
}
