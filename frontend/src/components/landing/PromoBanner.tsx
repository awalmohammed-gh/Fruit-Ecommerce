import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import ContentLink from "../common/ContentLink";
import { ease, fadeUp, revealOnScroll, stagger } from "../common/motion";
import { useSiteContent } from "../../hooks/useSiteContent";
import type { Placement, StoreBanner } from "../../frontApisRoute/content";
import { sizedImage } from "../../utils/links";

type BannerContent = Pick<StoreBanner, "badge" | "title" | "highlight" | "description" | "image" | "buttonText" | "buttonLink">;

// One promotional banner, as set in Admin → Settings → Promotional Banners. Also used for the admin preview.
export const BannerCard = ({ banner }: { banner: BannerContent }) => (
  <motion.section aria-label={banner.title} className="relative overflow-hidden rounded-3xl bg-app-green" {...revealOnScroll} variants={fadeUp}>
    <div className={`grid items-center gap-4 p-6 sm:p-10 lg:p-12 ${banner.image ? "md:grid-cols-2" : ""}`}>
      <motion.div variants={stagger(0.1, 0.2)} className="min-w-0">
        {banner.badge && <motion.span variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-semibold text-green-200 mb-4"><Sparkles className="size-4" aria-hidden="true" />{banner.badge}</motion.span>}
        <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white leading-tight wrap-break-word">
          {banner.title}{banner.highlight && <><br /><span className="text-orange-300">{banner.highlight}</span></>}
        </motion.h2>
        {banner.description && <motion.p variants={fadeUp} className="text-sm sm:text-base text-white/75 max-w-md mt-4 leading-relaxed">{banner.description}</motion.p>}
        {banner.buttonText && (
          <motion.div variants={fadeUp} className="mt-6">
            <ContentLink to={banner.buttonLink} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 bg-white text-app-green font-semibold text-sm hover:bg-orange-100">
              {banner.buttonText} <ArrowRight className="size-4" aria-hidden="true" />
            </ContentLink>
          </motion.div>
        )}
      </motion.div>
      {banner.image && (
        <div className="relative flex items-center justify-center py-4 md:py-0">
          <div className="absolute size-48 sm:size-64 rounded-full bg-white/5" aria-hidden="true" />
          {/* The picture slides in with the section (outer), then idles with a slight bob (inner). */}
          <motion.div className="relative w-full max-w-64 sm:max-w-80" variants={{ hidden: { opacity: 0, x: 80 }, show: { opacity: 1, x: 0, transition: { duration: 0.9, ease, delay: 0.25 } } }}>
            <motion.img src={sizedImage(banner.image, 640)} alt="" loading="lazy" decoding="async" className="w-full h-auto max-h-72 object-contain"
              animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }} />
          </motion.div>
        </div>
      )}
    </div>
  </motion.section>
);

// Every live banner for one spot on the site. Category banners show on their category (or on all, if none is set).
const PromoBanners = ({ placement, category = "", className = "" }: { placement: Placement; category?: string; className?: string }) => {
  const { data } = useSiteContent();
  const banners = (data?.banners ?? []).filter((banner) => banner.placement === placement && (placement !== "category" || !banner.category || banner.category === category));
  if (banners.length === 0) return null;
  return <div className={`space-y-6 ${className}`}>{banners.map((banner) => <BannerCard key={banner._id} banner={banner} />)}</div>;
};
export default PromoBanners;
