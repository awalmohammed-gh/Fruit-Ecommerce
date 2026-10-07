import { Mail, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import ContentLink from "../common/ContentLink";
import { fadeUp, revealOnScroll } from "../common/motion";
import { useSiteContent } from "../../hooks/useSiteContent";
import type { Advert } from "../../frontApisRoute/content";
import { sizedImage } from "../../utils/links";

// The deals strip at the bottom of the home page, set in Admin → Settings → Advertisements.
// The admin preview renders the view with unsaved changes.
export const NewsletterView = ({ ad }: { ad: Advert }) => (
    <motion.section {...revealOnScroll} variants={fadeUp} aria-labelledby="newsletter-heading" className="grid md:grid-cols-[1fr_auto] items-center gap-6 rounded-2xl border border-app-border bg-white p-6 sm:p-8">
      <div className="min-w-0">
        {ad.label && <div className="flex items-center gap-2 text-app-orange-dark text-xs font-semibold uppercase tracking-widest mb-3"><Mail className="size-4" aria-hidden="true" />{ad.label}</div>}
        <h2 id="newsletter-heading" className="font-serif text-2xl sm:text-3xl text-app-green wrap-break-word">{ad.title}</h2>
        {ad.description && <p className="text-sm text-app-text-light mt-2 leading-relaxed max-w-2xl">{ad.description}</p>}
      </div>
      {(ad.image || ad.ctaText) && (
        <div className="flex flex-col items-stretch md:items-end gap-4">
          {ad.image && <img src={sizedImage(ad.image, 400)} alt="" loading="lazy" decoding="async" className="w-full max-w-48 h-auto max-h-40 object-contain self-center md:self-end" />}
          {ad.ctaText && <ContentLink to={ad.ctaLink} className="inline-flex items-center justify-center gap-2 rounded-full border border-app-green/20 px-6 py-3 text-sm font-semibold text-app-green hover:bg-green-50">{ad.ctaText} <ArrowRight className="size-4" aria-hidden="true" /></ContentLink>}
        </div>
      )}
    </motion.section>
);

const Newsletter = () => {
  const ad = useSiteContent().data?.ads.newsletter;
  return ad ? <NewsletterView ad={ad} /> : null;
};
export default Newsletter;
