import ProductCard from "../card/ProductCard";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { cardIn, fadeUp, revealOnScroll } from "./motion";
import { productsApi } from "../../frontApisRoute/products";
import { useResource } from "../../hooks/useResource";
import { categoryPath } from "../../utils/links";
import { useStoreCategories } from "../../hooks/useStoreCategories";

const RelatedProduct = ({ category, excludeId }: { category: string; excludeId: string }) => {
  const { data } = useResource(`related:${category}:${excludeId}`, () => productsApi.list({ category, sort: "rating", limit: 5, view: "card" }));
  const products = (data?.products ?? []).filter((product) => product._id !== excludeId).slice(0, 4);
  const isPublic = useStoreCategories().categories.some((item) => item.slug === category);
  if (!products.length) return null;
  return (
    <section aria-labelledby="related-heading" className="mt-12 sm:mt-16">
      <motion.div {...revealOnScroll} variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><p className="text-xs uppercase tracking-widest font-semibold text-app-orange-dark mb-2">Complete your basket</p><h2 id="related-heading" className="font-serif text-3xl text-app-green">You may also like</h2><p className="text-sm text-app-text-light mt-2">More to explore in this category.</p></div>
        <Link to={isPublic ? categoryPath(category) : "/products"} className="inline-flex items-center gap-2 text-sm font-semibold text-app-green">View category <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {products.map((product, index) => <motion.div key={product._id} custom={index} variants={cardIn} {...revealOnScroll} className="grid min-w-0"><ProductCard product={product} /></motion.div>)}
      </div>
    </section>
  );
};
export default RelatedProduct;
