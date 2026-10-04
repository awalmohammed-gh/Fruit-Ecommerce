import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronRight, Leaf, ShoppingBasket, Tag } from "lucide-react";
import ProductCard from "../components/card/ProductCard";
import { productPath, sizedImage } from "../utils/links";
import { filterDeals } from "../utils/deals";
import { productsApi } from "../frontApisRoute/products";
import { useResource } from "../hooks/useResource";
import { useStoreCategories } from "../hooks/useStoreCategories";
import { motion } from "motion/react";
import { cardIn, ease, fadeUp, revealOnScroll, stagger } from "../components/common/motion";
import "./deals.css";

const money = (value: number) => value.toLocaleString("en-GH", { style: "currency", currency: "GHS" });

const FlashDeals = () => {
  const [params, setParams] = useSearchParams();
  // Every in-stock product with a real price reduction, biggest discount first.
  const offers = useResource("deals", () => productsApi.all({ onSale: true, stock: "in", sort: "discount" }));
  const { categories, nameOf } = useStoreCategories();
  const deals = offers.data ?? [];
  const departments = categories.filter((department) => deals.some((product) => product.category === department.slug));
  const featured = deals.find((product) => product.category === "fruits-vegetables") || deals[0];
  const maxDiscount = Math.max(0, ...deals.map((product) => product.discount));
  const category = params.get("category") || "";
  const sort = params.get("sort") || "";
  const visible = filterDeals(deals, category, sort);
  const activeCategory = category ? { name: nameOf(category) } : undefined;
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  return (
    <div className="offers-page">
      <nav aria-label="Breadcrumb" className="offers-breadcrumb"><Link to="/">Home</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">Market offers</span></nav>
      <header className="offers-hero">
        <motion.div className="offers-hero-copy" initial="hidden" animate="show" variants={stagger(0.1, 0.05)}>
          <motion.p variants={fadeUp} className="offers-eyebrow"><Tag size={14} aria-hidden="true" />THE GOOD VALUE EDIT</motion.p>
          <motion.h1 variants={fadeUp}>Good food.<br /><em>Even better prices.</em></motion.h1>
          <motion.p variants={fadeUp} className="offers-description">A fuller basket, a happier budget. Discover little savings<br className="hidden lg:block" /> on fresh favourites and the things you buy every day.</motion.p>
          <motion.div variants={fadeUp}><a href="#offers-selection" className="offers-primary">Explore the offers <ArrowRight size={16} aria-hidden="true" /></a></motion.div>
          <motion.div variants={fadeUp} className="offers-hero-footnote"><span className="offers-small-dot" />{!offers.data ? "Loading offers…" : deals.length ? <><strong>{deals.length} offers</strong><span className="offers-note-divider" />Up to {maxDiscount}% off selected products</> : "New offers will appear here"}</motion.div>
        </motion.div>
        {featured && <div className="offers-feature">
          <motion.div className="offers-feature-orbit" aria-hidden="true"
            initial={{ opacity: 0, scale: 0.85, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: -12 }} transition={{ duration: 0.9, ease }} />
          <motion.span className="offers-feature-caption"
            initial={{ opacity: 0, y: 8, rotate: -5 }} animate={{ opacity: 1, y: 0, rotate: -5 }} transition={{ duration: 0.6, ease, delay: 0.75 }}>A little something for your basket.</motion.span>
          {/* Outer: a slow idle drift once the ticket has landed, too small to pull focus. It moves down, away from the caption above. Inner: the drop-in. */}
          <motion.div animate={{ y: [0, 4, 0], rotate: [0, -0.6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}>
          <motion.article className="offers-ticket"
            initial={{ opacity: 0, y: 40, rotate: 10 }} animate={{ opacity: 1, y: 0, rotate: 4 }} transition={{ duration: 0.9, ease, delay: 0.2 }}>
            <div className="offers-ticket-heading"><span>THE FRESH PICK</span><Leaf size={17} aria-hidden="true" /></div>
            <Link to={productPath(featured)} aria-label={`View offer for ${featured.name}`} className="offers-feature-image"><img src={sizedImage(featured.image, 520)} alt={`${featured.name} product image`} fetchPriority="high" width={260} height={260} /><motion.span className="offers-discount-stamp"
              initial={{ opacity: 0, scale: 0.4, rotate: -40 }} animate={{ opacity: 1, scale: 1, rotate: -12 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.85 }}><strong>{featured.discount}%</strong><span>OFF</span></motion.span></Link>
            <div className="offers-ticket-tear" aria-hidden="true" />
            <div className="offers-ticket-body">
              <p className="offers-ticket-unit">Per {featured.unit}</p>
              <h2><Link to={productPath(featured)}>{featured.name}</Link></h2>
              <div className="offers-ticket-price"><strong>{money(featured.price)}</strong><del>{money(featured.originalPrice)}</del></div>
              <Link to={productPath(featured)} className="offers-ticket-link">Take a closer look <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </motion.article>
          </motion.div>
          <motion.span className="offers-saving-note"
            initial={{ opacity: 0, x: -10, rotate: -7 }} animate={{ opacity: 1, x: 0, rotate: -7 }} transition={{ duration: 0.6, ease, delay: 1 }}>Save {money(featured.originalPrice - featured.price)}<br /><small>on this little favourite</small></motion.span>
        </div>}
      </header>
      <motion.div {...revealOnScroll} variants={fadeUp} className="offers-value-strip" aria-label="Offer information">
        <p><Tag size={17} aria-hidden="true" /><span><strong>Less on the receipt.</strong> More in your basket.</span></p>
        <p><ShoppingBasket size={17} aria-hidden="true" /><span>Available offers, ready to shop.</span></p>
        <Link to="/products">Browse the whole market <ArrowRight size={15} aria-hidden="true" /></Link>
      </motion.div>
      <section id="offers-selection" aria-labelledby="offers-heading" className="offers-selection">
        <motion.div {...revealOnScroll} variants={fadeUp} className="offers-selection-heading">
          <div><p className="offers-eyebrow">SMALL SAVINGS. EVERYDAY JOY.</p><h2 id="offers-heading">Find your next good deal.</h2></div>
          <div className="offers-sort"><label htmlFor="offers-sort">Sort by</label><select id="offers-sort" value={sort} onChange={(event) => change("sort", event.target.value)}><option value="">Biggest discount</option><option value="saving">Highest GHS saving</option><option value="price">Lowest price</option></select><ChevronDown size={14} aria-hidden="true" /></div>
        </motion.div>
        <div className="offers-tabs" role="group" aria-label="Offer categories">
          <button type="button" aria-pressed={!category} onClick={() => change("category", "")}>All offers <span>{deals.length}</span></button>
          {departments.map((department) => <button key={department.slug} type="button" aria-pressed={category === department.slug} onClick={() => change("category", department.slug)}>{department.name}<span>{deals.filter((product) => product.category === department.slug).length}</span></button>)}
        </div>
        <div className="offers-results"><p role="status" aria-live="polite"><strong>{visible.length}</strong> {visible.length === 1 ? "offer" : "offers"}{category && ` in ${activeCategory?.name || category}`}</p><span>Original prices shown for easy comparison</span></div>
        {offers.error ? <div className="offers-empty" role="alert"><Tag size={28} aria-hidden="true" /><h3>We couldn't load the offers.</h3><p>{offers.error}</p><button type="button" onClick={offers.reload}>Try again <ArrowRight size={15} /></button></div>
          : !offers.data ? <div className="offers-grid" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[3/4] rounded-2xl bg-white border border-app-border animate-pulse" />)}</div>
          : visible.length > 0 ? <div key={`${category}|${sort}`} className="offers-grid">{visible.map((product, index) => (
          <motion.div key={product._id} custom={index} variants={cardIn} {...revealOnScroll} className="offers-product">
            <ProductCard product={product} />
            <p className="offers-product-saving"><Tag size={12} aria-hidden="true" />You save <strong>{money(product.originalPrice - product.price)}</strong></p>
          </motion.div>
        ))}</div> : <motion.div key="empty" initial="hidden" animate="show" variants={fadeUp} className="offers-empty"><Tag size={28} aria-hidden="true" /><h3>No offers in this corner just yet.</h3><p>Try another department, or explore the rest of the market.</p>{category ? <button type="button" onClick={() => change("category", "")}>See all offers <ArrowRight size={15} /></button> : <Link to="/products">Explore the market <ArrowRight size={15} /></Link>}</motion.div>}
      </section>
      <motion.section {...revealOnScroll} variants={fadeUp} className="offers-more" aria-labelledby="offers-more-heading"><div><span className="offers-eyebrow">THERE'S MORE IN STORE</span><h2 id="offers-more-heading">Something fresh for every day.</h2><p>Fruit, pantry essentials, and everything in between.</p></div><Link to="/products">Shop the market <ArrowRight size={17} aria-hidden="true" /></Link></motion.section>
      <p className="offers-footer-note">Savings compare the listed original and current prices. Availability may change.</p>
    </div>
  );
};
export default FlashDeals;
