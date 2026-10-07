import { useEffect, useRef, useState } from "react";
import PromoBanners from "../components/landing/PromoBanner";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Leaf, SlidersHorizontal, X, Search, ShoppingBasket, PackageCheck, Check, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { cardIn, ease, fadeScale, fadeUp, revealOnScroll, stagger } from "../components/common/motion";
import ProductCard from "../components/card/ProductCard";
import FilterPanel from "../components/card/FilterPanel";
import PriceFilter from "../components/card/PriceFilter";
import { productsApi, type ProductQuery } from "../frontApisRoute/products";
import { useResource } from "../hooks/useResource";
import { useStoreCategories } from "../hooks/useStoreCategories";
import "./market.css";
import { sizedImage } from "../utils/links";
import { useCustomerAuth } from '../context/CustomerAuthContext';

const PAGE_SIZE = 12;
const filterKeys = ["category", "minPrice", "maxPrice", "organic", "inStock"] as const;
// Background tints for the department rail, repeated in order.
const tints = ["#f1eadb", "#fce7dc", "#fff0c8", "#f9ecd0", "#e7eedc", "#f4e5d7"];

// URL search params -> products API query.
function toQuery(params: URLSearchParams, page = Math.max(1, Number(params.get("page")) || 1), limit = PAGE_SIZE): ProductQuery {
  return {
    category: params.get("category") || "",
    minPrice: params.get("minPrice") || undefined,
    maxPrice: params.get("maxPrice") || undefined,
    organic: params.get("organic") === "true" ? "true" : "",
    stock: params.get("inStock") === "true" ? "in" : "",
    sort: params.get("sort") || "newest",
    page, limit, view: "card",
  } as ProductQuery;
}
const invalidBudget = (params: URLSearchParams) => Boolean(params.get("minPrice") && params.get("maxPrice") && Number(params.get("minPrice")) > Number(params.get("maxPrice")));

const Products = () => {
  const { user } = useCustomerAuth();
  const [searchParams] = useSearchParams();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const params = new URLSearchParams(searchParams);
  if (slug) params.set("category", slug);
  if (!params.has('sort') && user?.preferences?.productSort) params.set('sort', user.preferences.productSort);
  const category = params.get("category") || "";
  const applyParams = (next: URLSearchParams) => {
    const updated = new URLSearchParams(next);
    const selected = updated.get("category");
    updated.delete("category");
    const query = updated.toString();
    const path = selected ? `/category/${encodeURIComponent(selected)}` : "/products";
    navigate(query ? `${path}?${query}` : path);
  };
  // Old category links (/products?category=dairy-eggs) move to the category's own address.
  const legacyCategory = slug ? "" : searchParams.get("category") || "";
  useEffect(() => {
    if (!legacyCategory) return;
    const rest = new URLSearchParams(searchParams);
    rest.delete("category");
    navigate(`/category/${encodeURIComponent(legacyCategory)}${rest.size ? `?${rest}` : ""}`, { replace: true });
  }, [legacyCategory, searchParams, navigate]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(() => new URLSearchParams(params));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const categoryResource = useStoreCategories();
  const { categories, nameOf } = categoryResource;
  const selectedCategory = categoryResource.data?.categories.find((item) => item.slug === category);
  const categoryPending = Boolean(category) && categoryResource.loading;
  const [failedImage, setFailedImage] = useState("");
  const badBudget = invalidBudget(params);
  const results = useResource(`market:${params.toString()}:${selectedCategory?._id ?? ""}`, () => (badBudget || (category && !selectedCategory) ? Promise.resolve(null) : productsApi.list(toQuery(params))));
  // Two well-rated products decorate the intro.
  const scene = useResource(`market-scene:${category ? "category" : "all"}`, () => category ? Promise.resolve(null) : productsApi.list({ sort: "rating", stock: "in", limit: 2, view: "card" }));
  const draftCount = useResource(`market-draft:${filterOpen ? draft.toString() : ""}`, () =>
    !filterOpen || invalidBudget(draft) ? Promise.resolve(null) : productsApi.list(toQuery(draft, 1, 1)).then((result) => result.pagination.total));

  const total = results.loading || categoryPending ? 0 : results.data?.pagination.total ?? 0;
  const page = results.data?.pagination.page ?? 1;
  const totalPages = results.data?.pagination.totalPages ?? 1;
  const visible = results.data?.products ?? [];
  const activeFilters = filterKeys.filter((key) => Boolean(params.get(key)));
  const heading = category ? selectedCategory?.name ?? "" : "A little fresh. A lot of good.";
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
  const sceneImages = category ? [] : scene.data?.products.map((product) => product.image) ?? [];
  // Category heroes never borrow a product image when their own image is absent.
  const categoryImage = selectedCategory?.image?.trim() || "";
  const showCategoryImage = !categoryPending && categoryImage && failedImage !== categoryImage;
  const allCount = categories.reduce((sum, item) => sum + item.productCount, 0);
  const rail = [
    { key: "", name: "All groceries", caption: "The whole market", image: categories.find((item) => item.image)?.image ?? "", count: allCount },
    ...categories.map((item) => ({ key: item.slug, name: item.name, caption: "", image: item.image, count: item.productCount })),
  ];
  const filterName = (key: string, source: URLSearchParams) => {
    if (key === "category") return nameOf(source.get(key) || "");
    if (key === "organic") return "Organic";
    if (key === "inStock") return "In stock";
    return `${key === "minPrice" ? "From" : "Up to"} GHS ${source.get(key)}`;
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!filterOpen || !dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [filterOpen]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    applyParams(next);
  };
  const setPrice = (min: string, max: string) => {
    const next = new URLSearchParams(params);
    if (min !== "") next.set("minPrice", min); else next.delete("minPrice");
    if (max !== "") next.set("maxPrice", max); else next.delete("maxPrice");
    next.delete("page"); applyParams(next);
  };
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    filterKeys.forEach((key) => next.delete(key)); next.delete("page"); applyParams(next);
  };
  const openFilters = () => { setDraft(new URLSearchParams(params)); setFilterOpen(true); };
  const updateDraft = (key: string, value: string) => setDraft((previous) => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page"); return next;
  });
  const resetDraft = () => setDraft((previous) => {
    const next = new URLSearchParams(previous);
    filterKeys.forEach((key) => next.delete(key)); next.delete("page"); return next;
  });
  const goToPage = (value: number) => { updateFilter("page", String(value)); document.getElementById("market-results")?.scrollIntoView({ block: "start" }); };

  // A department with no products at all (rather than one narrowed by other filters).
  const emptyDepartment = Boolean(category) && activeFilters.length === 1;
  let grid;
  if (results.error) {
    grid = <div className="market-empty" role="alert"><AlertCircle size={28} aria-hidden="true" /><h2>We couldn't load the market.</h2><p>{results.error}</p><button type="button" onClick={results.reload}>Try again <ArrowRight size={16} /></button></div>;
  } else if ((results.loading || !results.data) && !badBudget) {
    grid = <div className="market-product-grid" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[3/4] rounded-2xl bg-white border border-app-border animate-pulse" />)}</div>;
  } else if (visible.length > 0) {
    // Keyed by the filters and page, so a new selection replays the card reveal.
    grid = <div key={params.toString()} className="market-product-grid">{visible.map((product, index) => (
      <motion.div key={product._id} custom={index} variants={cardIn} {...revealOnScroll} className="grid min-w-0"><ProductCard product={product} /></motion.div>
    ))}</div>;
  } else {
    grid = <motion.div key="empty" initial="hidden" animate="show" variants={fadeUp} className="market-empty"><Search size={28} aria-hidden="true" /><h2>No picks in this basket yet.</h2><p>{badBudget ? "The lowest price is higher than the highest price." : emptyDepartment ? `Nothing in ${nameOf(category)} just yet. New stock is on its way.` : "Try a different price range or loosen a filter."}<br />There's plenty more in the market.</p><button type="button" onClick={clearFilters}>Explore all groceries <ArrowRight size={16} /></button></motion.div>;
  }

  return (
    <div className="market-page">
      <nav aria-label="Breadcrumb" className="market-breadcrumb"><Link to="/">Home</Link><ChevronRight size={12} aria-hidden="true" />{category ? <><Link to="/products">Categories</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{categoryPending ? "Loading…" : selectedCategory?.name || "Category not found"}</span></> : <span aria-current="page">The market</span>}</nav>
      {category && !categoryPending && (categoryResource.error || !selectedCategory) ? (
        <section className="market-empty" role={categoryResource.error ? "alert" : undefined}>
          <ShoppingBasket size={28} aria-hidden="true" />
          <h1>{categoryResource.error ? "We couldn't load this category." : "Category not found"}</h1>
          <p>{categoryResource.error || "This category is unavailable. Explore the market to find something fresh."}</p>
          {categoryResource.error && <button type="button" onClick={categoryResource.reload}>Try again</button>}
          <Link to="/products">Browse all groceries <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      ) : <>
      <header className={`market-intro ${category ? "market-category-intro" : ""}`}>
        <motion.div className="market-intro-copy" initial="hidden" animate="show" variants={stagger(0.1, 0.05)}>
          <motion.p variants={fadeUp} className="market-eyebrow"><span />{category ? "FROM THE GREEN FARM MARKET" : "THE GREEN FARM MARKET"}</motion.p>
          {/* Keyed by heading so it re-animates when the department changes. */}
          {categoryPending ? <div className="market-category-skeleton" role="status" aria-label="Loading category"><span /><span /></div> : <>
            <motion.h1 key={heading} variants={fadeUp}>{heading}</motion.h1>
            <motion.p key={`${category}:${selectedCategory?.description}`} variants={fadeUp} className="market-description">{category ? selectedCategory?.description || "Pick what you love. We'll bring it to your door." : <>From bright, juicy fruit to your everyday essentials.<br className="hidden sm:block" /> Pick what you love. We'll bring it to your door.</>}</motion.p>
          </>}
          <motion.div variants={fadeUp} className="market-intro-note"><ShoppingBasket size={16} aria-hidden="true" /><span>Your next good meal starts here.</span></motion.div>
        </motion.div>
        <motion.div className="market-fruit-scene" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <div className="market-fruit-oval" />
          {showCategoryImage && <motion.img key={`${category}:${categoryImage}`} className="market-category-image" src={categoryImage} alt="" width={280} height={240} onError={() => setFailedImage(categoryImage)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />}
          {/* rotate repeats the CSS angle, which Motion's inline transform would otherwise replace. */}
          {sceneImages[0] && <motion.img className="market-fruit-orange" src={sceneImages[0]} alt="" width={220} height={220}
            initial={{ opacity: 0, scale: 0.85, rotate: -9 }} animate={{ opacity: 1, scale: 1, rotate: -9, y: [0, -6, 0] }}
            transition={{ default: { duration: 0.7, ease, delay: 0.3 }, y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 } }} />}
          {sceneImages[1] && <motion.img className="market-fruit-mango" src={sceneImages[1]} alt="" width={230} height={230}
            initial={{ opacity: 0, scale: 0.85, rotate: 9 }} animate={{ opacity: 1, scale: 1, rotate: 9, y: [0, -8, 0] }}
            transition={{ default: { duration: 0.7, ease, delay: 0.45 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.4 } }} />}
          <span className="market-fruit-label"><Leaf size={14} />GOOD FOOD. GOOD MOOD.</span>
          <span className="market-scene-caption">A brighter kind of grocery shop.</span>
        </motion.div>
      </header>
      {/* Promotions from Admin → Settings: "Products page" banners on all groceries, "Category page" banners on a category. */}
      <PromoBanners placement={category ? "category" : "products"} category={category} className="market-promos" />
      {categories.length > 0 && <section aria-label="Explore the market" className="market-collections">
        <div className="market-section-caption"><span>WHAT'S ON YOUR LIST?</span><button type="button" onClick={openFilters}>All departments <ArrowRight size={14} aria-hidden="true" /></button></div>
        <motion.div className="market-collection-rail" initial="hidden" animate="show" variants={stagger(0.05, 0.25)}>
          {rail.map((item, index) => {
            const selected = item.key ? category === item.key : !category;
            return <motion.button variants={fadeScale} key={item.key} type="button" aria-pressed={selected} onClick={() => updateFilter("category", item.key)} className={`market-collection ${selected ? "selected" : ""}`}>
              <span className="market-collection-image" style={{ backgroundColor: tints[index % tints.length] }}>{item.image ? <img key={item.image} src={sizedImage(item.image, 200)} alt="" loading="lazy" width={100} height={100} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> : <ShoppingBasket size={34} className="market-collection-placeholder" aria-hidden="true" />}{selected && <span className="market-collection-check"><Check size={12} aria-hidden="true" /></span>}</span>
              <span className="market-collection-name">{item.name}<small>{item.count}</small></span>{item.caption && <span className="market-collection-caption">{item.caption}</span>}
            </motion.button>;
          })}
        </motion.div>
      </section>}
      <section id="market-results" aria-label="Market products" className="market-results">
        <div className="market-toolbar">
          <div className="market-quick-filters">
            <button type="button" onClick={openFilters} aria-haspopup="dialog" className="market-filter-button market-filter-main"><SlidersHorizontal size={16} aria-hidden="true" />Filters{activeFilters.length > 0 && <span className="market-filter-count">{activeFilters.length}</span>}</button>
            <span className="market-toolbar-divider" aria-hidden="true" />
            <PriceFilter minPrice={params.get("minPrice") || ""} maxPrice={params.get("maxPrice") || ""} onApply={setPrice} />
            <button type="button" aria-pressed={params.get("organic") === "true"} onClick={() => updateFilter("organic", params.get("organic") === "true" ? "" : "true")} className={`market-filter-button ${params.get("organic") === "true" ? "active" : ""}`}><Leaf size={15} aria-hidden="true" />Organic{params.get("organic") === "true" && <Check size={13} aria-hidden="true" />}</button>
            <button type="button" aria-pressed={params.get("inStock") === "true"} onClick={() => updateFilter("inStock", params.get("inStock") === "true" ? "" : "true")} className={`market-filter-button ${params.get("inStock") === "true" ? "active" : ""}`}><PackageCheck size={15} aria-hidden="true" />In stock{params.get("inStock") === "true" && <Check size={13} aria-hidden="true" />}</button>
          </div>
          <div className="market-sort"><label htmlFor="market-sort">Sort by</label><select id="market-sort" value={params.get("sort") || "newest"} onChange={(event) => updateFilter("sort", event.target.value)}><option value="newest">Newest arrivals</option><option value="rating">Highest rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name: A to Z</option></select><ChevronDown size={14} aria-hidden="true" /></div>
        </div>
        <div className="market-results-meta">
          <p role="status" aria-live="polite">{(!results.loading && results.data) || badBudget ? <><strong>{total}</strong> {total === 1 ? "good thing" : "good things"} to choose from{total > PAGE_SIZE && <span> · Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</span>}</> : "Loading the market…"}</p>
          {activeFilters.length > 0 && <button type="button" onClick={clearFilters}>Reset selection</button>}
        </div>
        {activeFilters.length > 0 && <div className="market-active-filters">
          {activeFilters.map((key) => <button key={key} type="button" onClick={() => updateFilter(key, "")} aria-label={`Remove ${filterName(key, params)} filter`}>{filterName(key, params)}<X size={12} aria-hidden="true" /></button>)}
        </div>}
        {grid}
        {!results.loading && totalPages > 1 && <nav aria-label="Product pages" className="market-pagination"><button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => goToPage(page - 1)}><ArrowLeft size={16} /></button>{pageNumbers.map((value) => <button key={value} type="button" aria-label={`Page ${value}`} aria-current={page === value ? "page" : undefined} onClick={() => goToPage(value)}>{value}</button>)}<button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => goToPage(page + 1)}><ArrowRight size={16} /></button></nav>}
      </section>
      <div className="market-bottom-note"><Leaf size={17} aria-hidden="true" /><p>A little colour on your plate. A little goodness in your day.</p></div>
      <dialog ref={dialogRef} aria-labelledby="market-filter-heading" onClose={() => setFilterOpen(false)} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setFilterOpen(false);
      }} className="market-filter-drawer">
        <div className="market-drawer-header"><div><p className="market-eyebrow">MAKE IT YOUR MARKET</p><h2 id="market-filter-heading">Find your good things.</h2></div><button type="button" aria-label="Close filters" onClick={() => setFilterOpen(false)}><X size={20} /></button></div>
        <div className="market-drawer-body">
          <FilterPanel categories={categories} category={draft.get("category") || ""} minPrice={draft.get("minPrice") || ""} maxPrice={draft.get("maxPrice") || ""} organic={draft.get("organic") === "true"} inStock={draft.get("inStock") === "true"} updateFilter={updateDraft} clearFilter={resetDraft} hasFilters={filterKeys.some((key) => Boolean(draft.get(key)))} />
        </div>
        <div className="market-drawer-footer"><button type="button" onClick={resetDraft}>Reset all</button><button type="button" disabled={invalidBudget(draft)} onClick={() => { applyParams(draft); setFilterOpen(false); }}>{typeof draftCount.data === "number" ? `Show ${draftCount.data} ${draftCount.data === 1 ? "product" : "products"}` : "Show products"} <ArrowRight size={16} aria-hidden="true" /></button></div>
      </dialog>
      </>}
    </div>
  );
};
export default Products;
