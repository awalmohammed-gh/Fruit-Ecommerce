import type { Advert, BannerInput, HeroSlide } from "../../../frontApisRoute/content";

// The same rules the server applies, checked before saving so mistakes show next to the field.
export const LINK_HINT = "A page on this site (/products), a home page section (#categories) or a web address.";

export type Problems<T> = Partial<Record<keyof T, string>>;

export function linkProblem(value: string) {
  const link = value.trim();
  if (!link) return null;
  if (link.startsWith("/") && !link.startsWith("//") && !link.includes("\\") && !/\s/.test(link)) return null;
  if (/^#[\w-]+$/.test(link)) return null;
  try {
    const url = new URL(link);
    if (url.protocol === "https:" || url.protocol === "http:") return null;
  } catch { /* not a web address */ }
  return "Use a page on this site (/products), a section (#categories) or a web address (https://…)";
}

// A button needs both its text and its link, or neither.
function button<T>(problems: Problems<T>, text: string, link: string, textKey: keyof T, linkKey: keyof T) {
  const linkError = linkProblem(link);
  if (linkError) problems[linkKey] = linkError;
  else if (text.trim() && !link.trim()) problems[linkKey] = "Add where the button goes";
  else if (!text.trim() && link.trim()) problems[textKey] = "Add the button text";
}

export function slideProblems(slide: HeroSlide) {
  const problems: Problems<HeroSlide> = {};
  if (slide.active && !slide.heading.trim()) problems.heading = "Add a heading";
  if (slide.active && !slide.image) problems.image = "Add an image";
  button(problems, slide.primaryText, slide.primaryLink, "primaryText", "primaryLink");
  button(problems, slide.secondaryText, slide.secondaryLink, "secondaryText", "secondaryLink");
  return problems;
}

export function advertProblems(ad: Advert) {
  const problems: Problems<Advert> = {};
  if (ad.active && !ad.title.trim()) problems.title = "Add a title";
  button(problems, ad.ctaText, ad.ctaLink, "ctaText", "ctaLink");
  return problems;
}

export function bannerProblems(banner: BannerInput) {
  const problems: Problems<BannerInput> = {};
  if (!banner.name.trim()) problems.name = "Give the banner a name";
  if (!banner.title.trim()) problems.title = "Add a title";
  button(problems, banner.buttonText, banner.buttonLink, "buttonText", "buttonLink");
  if (banner.startsAt && banner.endsAt && new Date(banner.endsAt) <= new Date(banner.startsAt)) problems.endsAt = "The end date must be after the start date";
  return problems;
}

export const hasProblems = (problems: object) => Object.keys(problems).length > 0;
