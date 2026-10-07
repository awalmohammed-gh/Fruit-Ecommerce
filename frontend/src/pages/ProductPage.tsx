import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useEffect, useState } from "react";
import type { Product } from "../types";
import { productsApi } from "../frontApisRoute/products";
import { useResource } from "../hooks/useResource";
import { useStoreCategories } from "../hooks/useStoreCategories";
import Loading from "../components/card/Loading";
import { ArrowRight, Check, ChevronRight, Leaf, Minus, Plus, ShoppingBag, Star, Truck, Package, Tag } from "lucide-react";
import RelatedProduct from "../components/common/RelatedProduct";
import ReviewsSection from "../components/common/ReviewsSection";
import { motion } from "motion/react";
import { ease, fadeUp, revealOnScroll, stagger } from "../components/common/motion";
import { categoryPath, productPath, sizedImage } from "../utils/links";
import { NotFoundView } from "./NotFound";
import { MAX_PER_PRODUCT, maxQuantity } from "../utils/orderLimits";

const MotionLink = motion.create(Link);

const currency = (value: number) => value.toLocaleString("en-GH", { style: "currency", currency: "GHS" });

const ProductDetails = ({ product, onReviewChanged }: { product: Product; onReviewChanged: () => void }) => {
  const { items, addToCart, updateQuantity, removeFromCart, setIsCartOpen } = useCart();
  const [quantity, setQuantity] = useState(1);
  const cartItem = items.find((item) => item.product._id === product._id);
  const displayQuantity = cartItem?.quantity ?? quantity;
  const available = product.stock > 0;
  const { categories, nameOf } = useStoreCategories();
  const category = categories.find((item) => item.slug === product.category);
  const categoryName = category?.name || nameOf(product.category);
  // Products whose category is disabled or not set up link to the shop instead of a missing page.
  const categoryLink = category ? categoryPath(product.category) : "/products";
  const onSale = product.originalPrice > product.price;
  const changeQuantity = (value: number) => {
    if (cartItem) {
      if (value <= 0) removeFromCart(product._id);
      else updateQuantity(product._id, Math.min(maxQuantity(product), value));
    } else setQuantity(Math.max(1, Math.min(maxQuantity(product), value)));
  };
  const primaryAction = () => (cartItem ? setIsCartOpen(true) : addToCart(product, quantity));
  const primaryLabel = !available ? "Out of stock" : cartItem ? "View your cart" : "Add to cart";

  const details = [
    { label: "Category", value: categoryName },
    { label: "Unit", value: product.unit },
    { label: "Organic", value: product.isOrganic ? "Yes" : "No" },
    { label: "Availability", value: available ? `${product.stock} in stock` : "Out of stock" },
  ];

  const quantityStepper = (
    <div role="group" aria-labelledby="quantity-label" className="flex items-center justify-between rounded-full border border-app-border bg-white shrink-0 w-36">
      <button type="button" aria-label={cartItem && displayQuantity === 1 ? "Remove from cart" : "Decrease quantity"} onClick={() => changeQuantity(displayQuantity - 1)} disabled={!available || (!cartItem && displayQuantity <= 1)} className="size-12 flex-center rounded-full hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent"><Minus className="size-4" /></button>
      <output className="text-base font-semibold text-app-green" aria-live="polite">{displayQuantity}</output>
      <button type="button" aria-label="Increase quantity" onClick={() => changeQuantity(displayQuantity + 1)} disabled={!available || displayQuantity >= maxQuantity(product)} className="size-12 flex-center rounded-full hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent"><Plus className="size-4" /></button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-28 lg:pb-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-app-text-light mb-6">
        <Link to="/" className="hover:text-app-green">Home</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link to="/products" className="hover:text-app-green">Shop</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link to={categoryLink} className="hover:text-app-green capitalize">{categoryName}</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page" className="text-app-green font-medium truncate max-w-48">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-start">
        {/* Image */}
        <div className="lg:sticky lg:top-24">
          <motion.div className="relative aspect-square min-w-0 rounded-3xl bg-[#f4f5f0] flex-center p-10 sm:p-16 overflow-hidden"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease }}>
            <div aria-hidden="true" className="absolute inset-12 rounded-full bg-white/60 blur-2xl" />
            <img src={sizedImage(product.image, 1000)} alt={`${product.name} product image`} fetchPriority="high" width={600} height={600} className={`relative w-full h-full object-contain drop-shadow-xl ${available ? "" : "opacity-50 grayscale"}`} />
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              {product.isOrganic && <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-app-green font-semibold shadow-sm"><Leaf className="size-3.5" aria-hidden="true" />Organic</span>}
              {product.discount > 0 && <span className="rounded-full bg-orange-100 text-orange-800 text-xs font-semibold px-3 py-1.5">{product.discount}% off</span>}
            </div>
          </motion.div>
        </div>

        {/* Info: each block fades up in reading order. */}
        <motion.div className="min-w-0" initial="hidden" animate="show" variants={stagger(0.07, 0.15)}>
          <MotionLink variants={fadeUp} to={categoryLink} className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-app-green/10 pl-1 pr-3 py-1 text-xs font-semibold text-app-green hover:bg-app-green hover:text-white transition-colors">
            {category?.image && <span className="size-6 rounded-full bg-white flex-center"><img src={sizedImage(category.image, 32)} alt="" className="size-4 object-contain" /></span>}
            {categoryName}
          </MotionLink>
          <motion.h1 variants={fadeUp} className="font-serif text-3xl sm:text-4xl lg:text-5xl text-app-green leading-tight mt-4">{product.name}</motion.h1>

          {product.rating > 0 && (
            <motion.a variants={fadeUp} href="#product-reviews" className="inline-flex items-center gap-2 text-sm text-app-text-light mt-4 hover:text-app-green transition-colors">
              <span className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`size-4 ${s <= Math.round(product.rating) ? "fill-amber-500 text-amber-600" : "text-app-border"}`} />)}
              </span>
              <span className="font-semibold text-app-green">{product.rating}</span>
              <span>· {product.reviewCount} reviews</span>
            </motion.a>
          )}

          <motion.p variants={fadeUp} className="text-sm sm:text-base leading-relaxed text-gray-600 mt-5">{product.description}</motion.p>

          {/* Purchase card */}
          <motion.div variants={fadeUp} className="mt-6 rounded-3xl border border-app-border bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl sm:text-4xl font-bold text-app-green">{currency(product.price)}</span>
              {onSale && <span className="text-base line-through text-app-text-light">{currency(product.originalPrice)}</span>}
              <span className="text-sm text-app-text-light">/ {product.unit}</span>
            </div>
            {onSale && <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold px-3 py-1 mt-3"><Tag className="size-3" aria-hidden="true" />You save {currency(product.originalPrice - product.price)} per {product.unit}</p>}

            <div className="flex items-center gap-2 text-sm mt-4">
              {available ? (
                <span className="inline-flex items-center gap-2 text-app-green"><span className="size-2 rounded-full bg-app-success" aria-hidden="true" />{product.stock < 10 ? `Only ${product.stock} left. Order soon` : "In stock · ready for your basket"}</span>
              ) : <span className="inline-flex items-center gap-2 text-red-700"><span className="size-2 rounded-full bg-app-error" aria-hidden="true" />Currently out of stock</span>}
            </div>

            <div className="border-t border-app-border mt-5 pt-5">
              <p className="block text-xs font-semibold uppercase tracking-widest text-app-text-light mb-3" id="quantity-label">Quantity {cartItem ? "in your cart" : ""}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {quantityStepper}
                <button type="button" onClick={primaryAction} disabled={!available} className="flex-1 min-h-12 inline-flex items-center justify-center gap-2 rounded-full bg-app-green text-white font-semibold text-sm px-6 hover:bg-app-green-light shadow-lg shadow-app-green/20 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed">
                  {cartItem ? <Check className="size-4" aria-hidden="true" /> : <ShoppingBag className="size-4" aria-hidden="true" />}
                  {primaryLabel}
                  {/* Re-keyed on quantity so the running total ticks when it changes. */}
                  {available && <motion.span key={displayQuantity} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="text-white/70">· {currency(product.price * displayQuantity)}</motion.span>}
                </button>
              </div>
              {displayQuantity >= maxQuantity(product) && available && <p role="status" className="text-xs text-app-text-light mt-3">{product.stock > MAX_PER_PRODUCT ? `Up to ${MAX_PER_PRODUCT} per order.` : `You've selected all ${product.stock} available.`}</p>}
            </div>
          </motion.div>

          {/* Perks */}
          <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-3 mt-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white border border-app-border p-4">
              <span className="size-10 rounded-full bg-green-50 flex-center shrink-0"><Truck className="size-5 text-app-green" aria-hidden="true" /></span>
              <div><p className="text-sm font-semibold text-app-green">Delivered to your door</p><p className="text-xs text-app-text-light mt-1">Delivery fees shown at checkout</p></div>
            </div>
            <Link to={categoryLink} className="group flex items-start gap-3 rounded-2xl bg-white border border-app-border p-4 hover:border-app-green/30">
              <span className="size-10 rounded-full bg-orange-50 flex-center shrink-0"><Package className="size-5 text-app-orange-dark" aria-hidden="true" /></span>
              <div><p className="text-sm font-semibold text-app-green">Keep exploring</p><p className="inline-flex items-center gap-1 text-xs text-app-text-light mt-1 group-hover:text-app-green">Shop {categoryName} <ArrowRight className="size-3" aria-hidden="true" /></p></div>
            </Link>
          </motion.div>

          {/* Details */}
          <motion.div variants={fadeUp} className="mt-6 rounded-2xl border border-app-border bg-white">
            <h2 className="px-5 py-3 border-b border-app-border text-xs font-semibold uppercase tracking-widest text-app-text-light">Product details</h2>
            <dl className="divide-y divide-app-border">
              {details.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <dt className="text-app-text-light">{label}</dt>
                  <dd className="font-medium text-app-green capitalize text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </motion.div>
      </div>

      <motion.div {...revealOnScroll} variants={fadeUp} id="product-reviews" className="scroll-mt-36 mt-12 sm:mt-16 rounded-3xl border border-app-border bg-white px-4 sm:px-8 pb-6"><ReviewsSection productId={product._id} onChanged={onReviewChanged} /></motion.div>
      <RelatedProduct category={product.category} excludeId={product._id} />

      {/* Mobile sticky purchase bar */}
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 0.45, ease, delay: 0.3 }} className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-white/95 backdrop-blur px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-app-green leading-none">{currency(product.price * displayQuantity)}</p>
            <p className="text-xs text-app-text-light mt-1">{displayQuantity} × {product.unit}</p>
          </div>
          <button type="button" onClick={primaryAction} disabled={!available} className="ml-auto min-h-12 inline-flex items-center justify-center gap-2 rounded-full bg-app-green text-white font-semibold text-sm px-6 hover:bg-app-green-light disabled:opacity-40 disabled:cursor-not-allowed">
            <ShoppingBag className="size-4" aria-hidden="true" />{primaryLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ProductPage = () => {
  // :id is the readable slug (/products/cheese-200g) or, for older links, the database ID.
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  const result = useResource(`product:${id}`, () => productsApi.get(id ?? ""));
  const product = result.data?.product;
  const missing = result.error && /not found|invalid/i.test(result.error);
  // Older ID links move to the readable address, so there is one address per product.
  const readable = product ? productPath(product) : null;
  useEffect(() => {
    if (readable && readable !== `/products/${id}`) navigate(readable, { replace: true });
  }, [readable, id, navigate]);
  if (!product && !result.error) return <Loading />;
  if (!product && !missing) return (
    <div role="alert" className="max-w-lg mx-auto px-6 py-24 text-center">
      <h1 className="font-serif text-3xl text-app-green">We couldn't load this product</h1>
      <p className="text-sm text-app-text-light mt-3 mb-6">{result.error}</p>
      <button type="button" onClick={result.reload} className="inline-flex gap-2 items-center rounded-full bg-app-green text-white px-6 py-3 text-sm font-semibold hover:bg-app-green-light">Try again</button>
    </div>
  );
  if (!product) return <NotFoundView title="Product not found" text="This product may no longer be available. Explore the shop for more fresh finds." />;
  return <ProductDetails key={product._id} product={product} onReviewChanged={result.reload} />;
};
export default ProductPage;
