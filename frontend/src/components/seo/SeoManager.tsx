import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { seoApi, type PageMeta } from "../../frontApisRoute/seo";

// Keeps the page title, description, canonical link, robots rule, sharing tags and structured data
// in step with the current address. The server decides them from the database (GET /api/seo), so
// product, category and homepage metadata follow whatever the admin last saved. When the server sends
// the page itself, the same tags are already in the HTML and are simply replaced here.
function apply(meta: PageMeta) {
  document.title = meta.title;
  document.head.querySelectorAll("[data-seo]").forEach((element) => element.remove());
  const added: Element[] = meta.tags.map(({ tag, attributes }) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  });
  for (const data of meta.jsonLd) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    added.push(script);
  }
  for (const element of added) {
    element.setAttribute("data-seo", "");
    document.head.appendChild(element);
  }
}

export default function SeoManager() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    let current = true;
    // A newer navigation wins; if the request fails the current tags simply stay.
    seoApi.page(pathname + search).then((meta) => { if (current) apply(meta); }, () => {});
    return () => { current = false; };
  }, [pathname, search]);
  return null;
}
