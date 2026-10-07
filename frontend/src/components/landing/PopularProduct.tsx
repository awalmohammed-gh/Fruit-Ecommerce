import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import ProductCard from "../card/ProductCard";
import { cardIn, fadeUp, revealOnScroll } from "../common/motion";
import { productsApi } from "../../frontApisRoute/products";
import { useResource } from "../../hooks/useResource";
import { useSiteContent } from "../../hooks/useSiteContent";

// Best-rated products in stock; until anything has reviews this is simply the newest stock.
const PopularProduct = () => {
  const { data } = useResource("popular-products", () => productsApi.list({ sort: "rating", stock: "in", limit: 8, view: "card" }));
  const products = data?.products ?? [];
  // Heading wording from Admin → Settings → Homepage Content.
  const heading = useSiteContent().data?.sections.popular;
  if (data && products.length === 0) return null;
  return (
    <section aria-labelledby="popular-heading">
      <motion.div className="flex flex-wrap items-end justify-between gap-4 mb-6" {...revealOnScroll} variants={fadeUp}>
        <div>
          {heading?.eyebrow && <p className="text-xs uppercase tracking-[0.18em] font-semibold text-app-orange-dark mb-2">{heading.eyebrow}</p>}
          <h2 id="popular-heading" className="font-serif text-3xl sm:text-4xl text-app-green">{heading?.heading ?? "Popular products"}</h2>
          {heading?.description && <p className="text-sm text-app-text-light mt-2">{heading.description}</p>}
        </div>
        <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-app-green hover:text-app-orange-dark">Shop all products <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* "grid" on the wrapper keeps cards stretched to equal heights per row. */}
        {data ? products.map((product, index) => <motion.div key={product._id} custom={index} variants={cardIn} {...revealOnScroll} className="grid min-w-0"><ProductCard product={product} /></motion.div>)
          : Array.from({ length: 4 }, (_, index) => <div key={index} className="aspect-[3/4] rounded-2xl bg-white border border-app-border animate-pulse" aria-hidden="true" />)}
      </div>
    </section>
  );
};
export default PopularProduct;
