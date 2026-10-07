import { motion } from "motion/react";
import { ArrowRight, Bike, CircleCheck } from "lucide-react";
import ContentLink from "../common/ContentLink";
import { fadeUp, revealOnScroll, stagger } from "../common/motion";
import { useSiteContent } from "../../hooks/useSiteContent";
import type { Advert } from "../../frontApisRoute/content";
import { sizedImage } from "../../utils/links";

// Recruits delivery partners from the home page (the application lives at /delivery-partner/apply).
// The wording is set in Admin → Settings → Advertisements; the admin preview renders the view with unsaved changes.
export const PartnerCalloutView = ({ ad }: { ad: Advert }) => (
    <motion.section aria-labelledby="partner-heading" className="rounded-3xl border border-app-border/70 bg-white overflow-hidden" {...revealOnScroll} variants={stagger(0.08)}>
      <div className="grid md:grid-cols-[1fr_auto] items-center gap-6 p-6 sm:p-10">
        <div className="min-w-0">
          {ad.label && (
            <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-xs font-semibold text-app-orange-dark mb-4">
              <Bike className="size-4" aria-hidden="true" /> {ad.label}
            </motion.span>
          )}
          <motion.h2 variants={fadeUp} id="partner-heading" className="font-serif text-3xl sm:text-4xl text-app-green leading-tight wrap-break-word">{ad.title}</motion.h2>
          {ad.description && <motion.p variants={fadeUp} className="text-sm sm:text-base text-app-text-light max-w-xl mt-3 leading-relaxed">{ad.description}</motion.p>}
          {ad.points.length > 0 && (
            <motion.ul variants={fadeUp} className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-sm text-zinc-700">
              {ad.points.map((point) => <li key={point} className="flex items-center gap-2"><CircleCheck className="size-4 text-app-green" aria-hidden="true" /> {point}</li>)}
            </motion.ul>
          )}
        </div>
        {(ad.image || ad.ctaText) && (
          <motion.div variants={fadeUp} className="flex flex-col items-stretch md:items-end gap-4">
            {ad.image && <img src={sizedImage(ad.image, 450)} alt="" loading="lazy" decoding="async" className="w-full max-w-56 h-auto max-h-48 object-contain self-center md:self-end" />}
            {ad.ctaText && (
              <ContentLink to={ad.ctaLink}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 bg-app-green text-white font-semibold text-sm hover:bg-app-green-light hover:gap-3 shadow-lg group">
                {ad.ctaText} <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </ContentLink>
            )}
          </motion.div>
        )}
      </div>
    </motion.section>
);

const PartnerCallout = () => {
  const ad = useSiteContent().data?.ads.partner;
  return ad ? <PartnerCalloutView ad={ad} /> : null;
};
export default PartnerCallout;
