import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgePercentIcon, BoxesIcon, DownloadIcon, LoaderCircleIcon, PackageIcon, PackageXIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Pagination from "../../components/admin/Pagination";
import ActionMenu from "../../components/admin/ActionMenu";
import Thumb from "../../components/admin/Thumb";
import Badge, { StockBadge } from "../../components/admin/Badge";
import { ConfirmDialog } from "../../components/admin/Modal";
import { SearchInput, Select, Toolbar } from "../../components/admin/Filters";
import { productsApi, type AdminProduct, type ProductQuery, type StockFilter } from "../../frontApisRoute/products";
import StockModal from "./components/StockModal";
import PricingModal from "./components/PricingModal";
import { useAdminStats } from "./lib/AdminStats";
import { useCategories } from "./lib/useCategories";
import { useLowStockThreshold } from "./lib/settings";
import { useResource } from "../../hooks/useResource";
import { stockState } from "./lib/stock";
import { downloadCsv } from "./lib/csv";
import { money, number, relativeDate } from "./lib/format";
import ui from "../../components/admin/ui.module.css";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name A–Z" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "stock_asc", label: "Stock: lowest first" },
  { value: "rating", label: "Highest rated" },
];

type Confirm = { kind: "delete" | "out"; product: AdminProduct } | null;

export default function AdminProducts() {
  const { preferences } = useAdminPreferences();
  const pageSize = preferences.pageSize;
  const threshold = useLowStockThreshold();
  const stats = useAdminStats();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const [stocking, setStocking] = useState<AdminProduct | null>(null);
  const [pricing, setPricing] = useState<AdminProduct | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filters = {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    stock: (params.get("stock") ?? "") as StockFilter | "",
    organic: (params.get("organic") ?? "") as "true" | "false" | "",
    sort: params.get("sort") ?? "newest",
  };
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query: ProductQuery = { ...filters, page, limit: pageSize, lowStockBelow: threshold };
  const products = useResource(`products:${JSON.stringify(query)}`, () => productsApi.list(query));
  const hasFilters = Boolean(filters.q || filters.category || filters.stock || filters.organic);

  const setFilter = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value && !(key === "sort" && value === "newest")) next.set(key, value); else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: key !== "page" });
  };

  const afterChange = () => { products.reload(); stats.refresh(); };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "delete") {
        await productsApi.remove(confirm.product._id);
        toast.success(`${confirm.product.name} deleted`);
      } else {
        await productsApi.update(confirm.product._id, { stock: 0 });
        toast.success(`${confirm.product.name} marked out of stock`);
      }
      setConfirm(null);
      afterChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await productsApi.all({ ...filters, lowStockBelow: threshold });
      downloadCsv("greenfarm-products", ["Name", "Category", "Unit", "Price (GHS)", "Original price (GHS)", "Discount %", "Stock", "Stock status", "Organic", "Rating", "Updated"],
        rows.map((product) => [product.name, categories.nameOf(product.category), product.unit, product.price, product.originalPrice, product.discount, product.stock,
          stockState(product.stock, threshold), product.isOrganic ? "Yes" : "No", product.rating, product.updatedAt]));
      toast.success(`Exported ${number(rows.length)} products`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<AdminProduct>[] = [
    {
      key: "product", header: "Product", primary: true, render: (product) => (
        <div className={ui.productCell}>
          <Thumb src={product.image} />
          <div className={ui.cellStack}>
            <Link to={`/admin/products/${product._id}/edit`} className={ui.cellPrimary} style={{ textDecoration: "none" }}>{product.name}</Link>
            <span className={ui.cellSecondary}>{product.unit}{product.isOrganic ? " · Organic" : ""}</span>
          </div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (product) => categories.nameOf(product.category) },
    {
      key: "price", header: "Price", align: "right", render: (product) => (
        <div className={ui.cellStack} style={{ alignItems: "flex-end" }}>
          <span className={ui.num}><strong>{money(product.price)}</strong>{product.discount > 0 && <span className={ui.strike}>{money(product.originalPrice)}</span>}</span>
          {product.discount > 0 && <Badge tone="deal" dot={false}>{product.discount}% off</Badge>}
        </div>
      ),
    },
    { key: "stock", header: "Stock", align: "right", render: (product) => <span className={ui.num}>{number(product.stock)}</span> },
    { key: "status", header: "Status", render: (product) => <StockBadge stock={product.stock} threshold={threshold} /> },
    { key: "updated", header: "Updated", render: (product) => <span className={ui.cellSecondary} title={product.updatedAt}>{relativeDate(product.updatedAt)}</span> },
    {
      key: "actions", header: "", align: "right", render: (product) => (
        <div className={ui.actions}>
          <Link to={`/admin/products/${product._id}/edit`} className={ui.iconButton} aria-label={`Edit ${product.name}`} title="Edit"><PencilIcon aria-hidden="true" /></Link>
          <ActionMenu label={`More actions for ${product.name}`} actions={[
            { label: "Update stock", icon: BoxesIcon, onSelect: () => setStocking(product) },
            { label: product.discount > 0 ? "Edit deal" : "Create deal", icon: BadgePercentIcon, onSelect: () => setPricing(product) },
            ...(product.stock > 0 ? [{ label: "Mark out of stock", icon: PackageXIcon, onSelect: () => setConfirm({ kind: "out", product }) }] : []),
            { label: "Delete product", icon: Trash2Icon, danger: true, separated: true, onSelect: () => setConfirm({ kind: "delete", product }) },
          ]} />
        </div>
      ),
    },
  ];

  const pagination = products.data?.pagination;
  const total = stats.products?.total;

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage products, pricing and inventory."
        count={total !== undefined ? `${number(total)} total` : undefined}
        actions={
          <>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={exportCsv} disabled={exporting || !pagination?.total}>
              {exporting ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />} Export
            </button>
            <Link to="/admin/products/new" className={`${ui.button} ${ui.primary}`}><PlusIcon aria-hidden="true" /> Add product</Link>
          </>
        }
      />

      <Panel flush>
        <Toolbar end={hasFilters ? <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setParams(filters.sort === "newest" ? {} : { sort: filters.sort })}>Clear filters</button> : undefined}>
          <SearchInput label="Search products" placeholder="Search by name or description" value={filters.q} onChange={(value) => setFilter("q", value)} />
          <Select label="Category" value={filters.category} onChange={(value) => setFilter("category", value)} options={[{ value: "", label: "All categories" }, ...categories.options]} />
          <Select label="Stock" value={filters.stock} onChange={(value) => setFilter("stock", value)} options={[
            { value: "", label: "Any stock" }, { value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" },
          ]} />
          <Select label="Type" value={filters.organic} onChange={(value) => setFilter("organic", value)} options={[
            { value: "", label: "Organic & regular" }, { value: "true", label: "Organic only" }, { value: "false", label: "Non-organic only" },
          ]} />
          <Select label="Sort" value={filters.sort} onChange={(value) => setFilter("sort", value)} options={SORTS} />
        </Toolbar>
        <DataTable
          label="Products"
          columns={columns}
          rows={products.data?.products ?? null}
          rowKey={(product) => product._id}
          loading={products.loading}
          error={products.error}
          onRetry={products.reload}
          rowTone={(product) => { const state = stockState(product.stock, threshold); return state === "out" ? "danger" : state === "low" ? "warning" : undefined; }}
          empty={hasFilters
            ? { icon: PackageIcon, title: "No products match these filters", text: "Try a different search or clear the filters." }
            : { icon: PackageIcon, title: "No products yet", text: "Add your first product to start selling.", action: <Link to="/admin/products/new" className={`${ui.button} ${ui.primary} ${ui.small}`}><PlusIcon aria-hidden="true" /> Add product</Link> }}
        />
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pageSize} noun="products" onChange={(next) => setFilter("page", String(next))} />}
      </Panel>

      {stocking && <StockModal product={stocking} threshold={threshold} onClose={() => setStocking(null)} onSaved={() => { setStocking(null); afterChange(); }} />}
      {pricing && <PricingModal product={pricing} onClose={() => setPricing(null)} onSaved={() => { setPricing(null); afterChange(); }} />}
      <ConfirmDialog
        open={!!confirm}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        title={confirm?.kind === "delete" ? "Delete product?" : "Mark out of stock?"}
        confirmLabel={confirm?.kind === "delete" ? "Delete product" : "Set stock to 0"}
        tone={confirm?.kind === "delete" ? "danger" : "primary"}
        message={confirm?.kind === "delete"
          ? <><strong>{confirm.product.name}</strong> will be removed from the store permanently. To stop selling it for now, set its stock to 0 instead.</>
          : <><strong>{confirm?.product.name}</strong> stays listed but customers won't be able to order it until you add stock.</>}
      />
    </>
  );
}
