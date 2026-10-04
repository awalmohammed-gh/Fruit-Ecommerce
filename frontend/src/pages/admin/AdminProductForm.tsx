import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, ImageIcon, LoaderCircleIcon, SaveIcon, Trash2Icon, UploadIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import SeoFields from "../../components/admin/SeoFields";
import Badge, { StockBadge } from "../../components/admin/Badge";
import { ConfirmDialog } from "../../components/admin/Modal";
import { ErrorState, LoadingState, Notice } from "../../components/admin/States";
import { productsApi, type AdminProduct, type ProductInput } from "../../frontApisRoute/products";
import { uploadsApi } from "../../frontApisRoute/customers";
import { useAdminStats } from "./lib/AdminStats";
import { discountPreview, useCategories } from "./lib/useCategories";
import { useLowStockThreshold } from "./lib/settings";
import { useResource } from "../../hooks/useResource";
import { date, money } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

interface FormState { name: string; description: string; category: string; unit: string; price: string; originalPrice: string; stock: string; image: string; isOrganic: boolean; seoTitle: string; seoDescription: string }

const blank: FormState = { name: "", description: "", category: "", unit: "", price: "", originalPrice: "", stock: "0", image: "", isOrganic: false, seoTitle: "", seoDescription: "" };

function fromProduct(product: AdminProduct): FormState {
  return {
    name: product.name, description: product.description, category: product.category, unit: product.unit,
    price: String(product.price), originalPrice: product.originalPrice > product.price ? String(product.originalPrice) : "",
    stock: String(product.stock), image: product.image, isOrganic: product.isOrganic,
    seoTitle: product.seoTitle ?? "", seoDescription: product.seoDescription ?? "",
  };
}

// Same rules the API enforces, checked first so the admin gets field-level messages.
function validate(form: FormState) {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.name.trim()) errors.name = "Enter a product name";
  if (!form.description.trim()) errors.description = "Add a short description";
  if (!form.category) errors.category = "Choose a category";
  if (!form.unit.trim()) errors.unit = "Enter the selling unit, such as 500g or 1L";
  const price = Number(form.price);
  if (form.price.trim() === "" || !Number.isFinite(price) || price < 0) errors.price = "Enter a price of 0 or more";
  if (form.originalPrice.trim() !== "") {
    const original = Number(form.originalPrice);
    if (!Number.isFinite(original) || original < 0) errors.originalPrice = "Enter a price of 0 or more";
    else if (!errors.price && original < price) errors.originalPrice = "Must be at least the selling price";
  }
  const stock = Number(form.stock);
  if (form.stock.trim() === "" || !Number.isInteger(stock) || stock < 0) errors.stock = "Stock must be a whole number of 0 or more";
  if (!/^https?:\/\/\S+$/i.test(form.image.trim())) errors.image = "Upload an image or paste an image URL";
  return errors;
}

export default function AdminProductForm() {
  const { id } = useParams();
  const product = useResource(`product:${id ?? "new"}`, async () => (id ? (await productsApi.get(id)).product : null));

  if (id && !product.data) {
    return (
      <>
        <PageHeader title="Edit product" description="Update details, pricing, stock and the product image." />
        <Panel>{product.error ? <ErrorState message={product.error} onRetry={product.reload} /> : <LoadingState label="Loading product" />}</Panel>
      </>
    );
  }
  return <ProductForm key={product.data?._id ?? "new"} product={product.data ?? null} />;
}

function ProductForm({ product }: { product: AdminProduct | null }) {
  const navigate = useNavigate();
  const stats = useAdminStats();
  const threshold = useLowStockThreshold();
  const categories = useCategories();
  const [form, setForm] = useState<FormState>(product ? fromProduct(product) : blank);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const errors = validate(form);
  const shown = (key: keyof FormState) => (submitted ? errors[key] : undefined);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const price = Number(form.price);
  const original = form.originalPrice.trim() ? Number(form.originalPrice) : price;
  const discount = discountPreview(price, original);
  const stock = Number(form.stock);
  const categoryMissing = !!form.category && !categories.options.some((option) => option.value === form.category);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return void toast.error("Images must be 2 MB or smaller");
    setUploading(true);
    try {
      set("image", (await uploadsApi.image(file)).url);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError("");
    if (Object.keys(errors).length) return void toast.error("Check the highlighted fields");
    const input: ProductInput = {
      name: form.name.trim(), description: form.description.trim(), category: form.category, unit: form.unit.trim(),
      image: form.image.trim(), price, originalPrice: form.originalPrice.trim() ? Number(form.originalPrice) : null,
      stock, isOrganic: form.isOrganic,
      seoTitle: form.seoTitle.trim(), seoDescription: form.seoDescription.trim(),
    };
    setSaving(true);
    try {
      const result = product ? await productsApi.update(product._id, input) : await productsApi.create(input);
      toast.success(product ? `${result.product.name} updated` : `${result.product.name} added`);
      stats.refresh();
      navigate("/admin/products");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to save the product");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product) return;
    setDeleting(true);
    try {
      await productsApi.remove(product._id);
      toast.success(`${product.name} deleted`);
      stats.refresh();
      navigate("/admin/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the product");
      setDeleting(false);
    }
  };

  const field = (key: keyof FormState) => ({ "aria-invalid": !!shown(key), "aria-describedby": shown(key) ? `${key}-error` : undefined });
  const error = (key: keyof FormState) => shown(key) && <span id={`${key}-error`} className={ui.hint} style={{ color: "var(--gf-danger)" }}>{shown(key)}</span>;

  return (
    <>
      <PageHeader
        title={product ? "Edit product" : "Add product"}
        description={product ? `Last updated ${date(product.updatedAt, true)}` : "Create a product customers can find and order."}
        actions={<Link to="/admin/products" className={`${ui.button} ${ui.secondary}`}><ArrowLeftIcon aria-hidden="true" /> Back to products</Link>}
      />

      <form onSubmit={submit} noValidate className={styles.stack16}>
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <div className={styles.formLayout}>
          <div className={styles.stack16}>
            <Panel title="Basic information" description="What customers see on the product card and page.">
              <div className={ui.formGrid}>
                <div className={`${ui.field} ${ui.span2}`}>
                  <label className={ui.label} htmlFor="product-name">Product name</label>
                  <input id="product-name" className={ui.input} maxLength={120} value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Cheese 200g" {...field("name")} />
                  {error("name")}
                </div>
                <div className={`${ui.field} ${ui.span2}`}>
                  <label className={ui.label} htmlFor="product-description">Description</label>
                  <textarea id="product-description" className={ui.textarea} maxLength={1000} value={form.description} onChange={(event) => set("description", event.target.value)}
                    placeholder="Creamy and delicious, perfect for pizzas and sandwiches, rich in calcium" {...field("description")} />
                  {error("description") || <span className={ui.hint}>Separate key benefits with commas. {form.description.length}/1000</span>}
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="product-category">Category</label>
                  <select id="product-category" className={ui.select} value={form.category} onChange={(event) => set("category", event.target.value)} {...field("category")}>
                    <option value="">{categories.data ? "Select a category" : "Loading categories…"}</option>
                    {categoryMissing && <option value={form.category}>{categories.nameOf(form.category)}</option>}
                    {categories.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {error("category") || <span className={ui.hint}>Missing one? <Link to="/admin/categories" className={styles.textLink}>Manage categories</Link></span>}
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="product-unit">Unit</label>
                  <input id="product-unit" className={ui.input} maxLength={30} value={form.unit} onChange={(event) => set("unit", event.target.value)} placeholder="e.g. 200g, 1kg, 1L, 12 pieces" {...field("unit")} />
                  {error("unit") || <span className={ui.hint}>The amount one purchase includes.</span>}
                </div>
              </div>
            </Panel>

            <Panel title="Pricing" description="The discount is calculated from the two prices when you save.">
              <div className={ui.formGrid}>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="product-price">Selling price</label>
                  <div className={ui.affix}><span className={ui.affixText}>GHS</span>
                    <input id="product-price" className={`${ui.input} ${ui.num}`} type="number" min={0} step="0.01" inputMode="decimal" value={form.price} onChange={(event) => set("price", event.target.value)} placeholder="0.00" {...field("price")} />
                  </div>
                  {error("price") || <span className={ui.hint}>What customers pay.</span>}
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="product-original">Original price <span className={ui.optional}>(optional)</span></label>
                  <div className={ui.affix}><span className={ui.affixText}>GHS</span>
                    <input id="product-original" className={`${ui.input} ${ui.num}`} type="number" min={0} step="0.01" inputMode="decimal" value={form.originalPrice} onChange={(event) => set("originalPrice", event.target.value)} placeholder="Leave blank if not on sale" {...field("originalPrice")} />
                  </div>
                  {error("originalPrice") || <span className={ui.hint}>The price before the discount. Shown struck through.</span>}
                </div>
                <div className={`${ui.field} ${ui.span2}`}>
                  <span className={ui.label}>Discount</span>
                  <div className={styles.inlineStatus}>
                    {discount > 0 ? <Badge tone="deal">{discount}% off · customers save {money(original - price)}</Badge> : <Badge tone="neutral">No discount</Badge>}
                    <span className={ui.hint}>Calculated automatically</span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Inventory" description="Products with 0 stock stay listed as out of stock.">
              <div className={ui.formGrid}>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="product-stock">Units in stock</label>
                  <input id="product-stock" className={`${ui.input} ${ui.num}`} type="number" min={0} step={1} inputMode="numeric" value={form.stock} onChange={(event) => set("stock", event.target.value)} {...field("stock")} />
                  {error("stock") || <span className={ui.hint}>Flagged as low stock below {threshold} units.</span>}
                </div>
                <div className={ui.field}>
                  <span className={ui.label}>Organic status</span>
                  <label className={ui.switchRow}>
                    <span className={ui.cellStack}><span className={ui.cellPrimary}>Certified organic</span><span className={ui.cellSecondary}>Shows the organic label and filter</span></span>
                    <input type="checkbox" role="switch" className={ui.switch} checked={form.isOrganic} onChange={(event) => set("isOrganic", event.target.checked)} />
                  </label>
                </div>
              </div>
            </Panel>
            <Panel title="Search and sharing" description="How this product appears on Google and in shared links.">
              <SeoFields title={form.seoTitle} description={form.seoDescription} onTitle={(value) => set("seoTitle", value)} onDescription={(value) => set("seoDescription", value)}
                name={form.name} fallbackDescription={form.description} path={product?.slug ? `/products/${product.slug}` : "/products/…"} disabled={saving} />
            </Panel>
          </div>

          <aside className={styles.formAside}>
            <Panel title="Media" description="JPG, PNG or WebP, up to 2 MB.">
              <div className={styles.stack16}>
                <div className={styles.imagePreview}>
                  {form.image && !errors.image ? <img src={form.image} alt="Product preview" /> : <span><ImageIcon aria-hidden="true" />No image yet</span>}
                </div>
                <div className={styles.uploadRow}>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className={styles.fileInput} onChange={upload} tabIndex={-1} aria-hidden="true" />
                  <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => fileInput.current?.click()} disabled={uploading}>
                    {uploading ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <UploadIcon aria-hidden="true" />} {uploading ? "Uploading…" : "Upload image"}
                  </button>
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="product-image">Image URL</label>
                  <input id="product-image" className={ui.input} type="url" value={form.image} onChange={(event) => set("image", event.target.value)} placeholder="https://…" {...field("image")} />
                  {error("image")}
                </div>
              </div>
            </Panel>

            <Panel title="Summary">
              <dl className={styles.summaryList}>
                <div><dt>Selling price</dt><dd>{Number.isFinite(price) && form.price ? money(price) : "–"}</dd></div>
                <div><dt>Discount</dt><dd>{discount ? `${discount}%` : "None"}</dd></div>
                <div><dt>Availability</dt><dd>{Number.isInteger(stock) && stock >= 0 ? <StockBadge stock={stock} threshold={threshold} /> : "–"}</dd></div>
                <div><dt>Organic</dt><dd>{form.isOrganic ? "Yes" : "No"}</dd></div>
                {product && <div><dt>Rating</dt><dd>{product.rating.toFixed(1)} ({product.reviewCount} reviews)</dd></div>}
              </dl>
            </Panel>
          </aside>
        </div>

        <div className={styles.actionBar}>
          {product && (
            <button type="button" className={`${ui.button} ${ui.dangerOutline}`} onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2Icon aria-hidden="true" /> Delete
            </button>
          )}
          <div className={styles.actionBarEnd}>
            <Link to="/admin/products" className={`${ui.button} ${ui.secondary}`}>Cancel</Link>
            <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={saving || uploading}>
              {saving ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <SaveIcon aria-hidden="true" />}
              {saving ? "Saving…" : product ? "Update product" : "Save product"}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog open={confirmDelete} busy={deleting} onClose={() => setConfirmDelete(false)} onConfirm={remove}
        title="Delete product?" confirmLabel="Delete product"
        message={<><strong>{product?.name}</strong> will be removed from the store permanently. To stop selling it for now, set its stock to 0 instead.</>} />
    </>
  );
}
