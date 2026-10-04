import { Link } from "react-router-dom";
import { ArrowRight, Home, ShoppingBasket } from "lucide-react";
import { motion } from "motion/react";
import { fadeUp } from "../components/common/motion";

// Unknown addresses, deleted products and disabled categories. The server marks these pages 404 and noindex.
export function NotFoundView({ title = "We couldn't find that page", text = "The page may have moved, or the link may be out of date. There's plenty more fresh food in the market." }: { title?: string; text?: string }) {
  return (
    <motion.section initial="hidden" animate="show" variants={fadeUp} className="max-w-lg mx-auto px-6 py-20 sm:py-28 text-center" aria-labelledby="not-found-heading">
      <div className="size-16 rounded-full bg-green-50 flex-center mx-auto mb-5"><ShoppingBasket className="size-8 text-app-green" aria-hidden="true" /></div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-orange-dark mb-2">Error 404</p>
      <h1 id="not-found-heading" className="font-serif text-3xl sm:text-4xl text-app-green">{title}</h1>
      <p className="text-sm text-app-text-light mt-3 mb-8 leading-relaxed">{text}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/products" className="inline-flex gap-2 items-center justify-center rounded-full bg-app-green text-white px-6 py-3 text-sm font-semibold hover:bg-app-green-light">Browse groceries <ArrowRight className="size-4" aria-hidden="true" /></Link>
        <Link to="/" className="inline-flex gap-2 items-center justify-center rounded-full border border-app-green/20 text-app-green px-6 py-3 text-sm font-semibold hover:bg-green-50"><Home className="size-4" aria-hidden="true" /> Back to home</Link>
      </div>
    </motion.section>
  );
}

const NotFound = () => <NotFoundView />;
export default NotFound;
