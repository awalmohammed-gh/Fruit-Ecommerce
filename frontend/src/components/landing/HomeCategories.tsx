import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBasket } from "lucide-react";
import { motion } from "motion/react";
import { fadeScale, fadeUp, revealOnScroll, stagger } from "../common/motion";
import { useStoreCategories } from "../../hooks/useStoreCategories";
import { useSiteContent } from "../../hooks/useSiteContent";
import { sizedImage } from "../../utils/links";

const MotionLink = motion.create(Link);

const HomeCategories = () => {
  const { categories, data } = useStoreCategories();
  // Heading wording from Admin → Settings → Homepage Content.
  const heading = useSiteContent().data?.sections.categories;
  // Nothing to browse until the shop has categorised products.
  if (data && categories.length === 0) return null;
  return (
  <section id="categories" aria-labelledby="categories-heading" className="scroll-mt-24">
    <motion.div className="flex flex-wrap items-end justify-between gap-4 mb-6" {...revealOnScroll} variants={fadeUp}>
      <div>
        {heading?.eyebrow && <p className="text-xs uppercase tracking-[0.18em] font-semibold text-app-orange-dark mb-2">{heading.eyebrow}</p>}
        <h2 id="categories-heading" className="font-serif text-3xl sm:text-4xl text-app-green">{heading?.heading ?? "Categories"}</h2>
        {heading?.description && <p className="text-sm text-app-text-light mt-2">{heading.description}</p>}
      </div>
      <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-app-green hover:text-app-orange-dark">Browse all <ArrowRight className="size-4" aria-hidden="true" /></Link>
    </motion.div>
    <p className="text-xs text-app-text-light mb-3 md:hidden">Swipe to explore all categories →</p>
    <motion.div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 md:grid md:grid-cols-5 md:overflow-visible md:pb-0" {...revealOnScroll} variants={stagger(0.05)}>
      {categories.map((category) => (
        <MotionLink variants={fadeScale} key={category.slug} to={`/category/${encodeURIComponent(category.slug)}`} onClick={() => window.scrollTo(0, 0)} className="group snap-start flex-none w-32 md:w-auto min-w-0 rounded-2xl border border-app-border bg-white p-4 flex flex-col items-center gap-3 hover:border-app-green/30 hover:bg-green-50/50 transition-colors">
          {category.image ? <img src={sizedImage(category.image, 200)} alt="" loading="lazy" decoding="async" width={88} height={88} className="size-20 lg:size-22 object-contain transition-transform motion-safe:group-hover:scale-105" />
            : <span className="size-20 lg:size-22 rounded-full bg-green-50 flex-center text-app-green/70" aria-hidden="true"><ShoppingBasket className="size-8" /></span>}
          <span className="text-center text-xs sm:text-sm font-medium text-app-green">{category.name}</span>
          {category.description && <span className="text-center text-xs text-app-text-light line-clamp-2">{category.description}</span>}
        </MotionLink>
      ))}
    </motion.div>
  </section>
  );
};
export default HomeCategories;
