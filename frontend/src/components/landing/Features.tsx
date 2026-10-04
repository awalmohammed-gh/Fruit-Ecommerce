import { Truck, Leaf, ShoppingBag, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { fadeUp, revealOnScroll, stagger } from "../common/motion";
import { useSiteContent } from "../../hooks/useSiteContent";

// The four store highlights under the hero. The wording is set in Admin → Settings → Homepage Content; the icons stay.
const ICONS = [Leaf, Truck, ShoppingBag, MapPin];

const Features = () => {
  const features = useSiteContent().data?.sections.features;
  if (!features?.length) return null;
  return (
    <motion.section aria-label="Why shop with Green Farm" className="rounded-2xl border border-app-border bg-white p-4 sm:p-6" {...revealOnScroll} variants={fadeUp}>
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6" variants={stagger(0.08, 0.15)}>
        {features.map(({ title, description }, index) => {
          const Icon = ICONS[index % ICONS.length]!;
          return (
            <motion.div key={index} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
              <div className="size-10 shrink-0 rounded-xl bg-green-50 flex items-center justify-center"><Icon className="size-5 text-app-green" aria-hidden="true" /></div>
              <div className="min-w-0"><p className="text-sm font-semibold text-app-green">{title}</p>{description && <p className="text-xs text-app-text-light mt-1 leading-relaxed">{description}</p>}</div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.section>
  );
};
export default Features;
