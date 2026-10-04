import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangleIcon, BoxesIcon, CheckIcon, DownloadIcon, LoaderCircleIcon, PackageCheckIcon, PackageXIcon, SettingsIcon, WalletIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import StatCard from "../../components/admin/StatCard";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Pagination from "../../components/admin/Pagination";
import Thumb from "../../components/admin/Thumb";
import { StockBadge } from "../../components/admin/Badge";
import { SearchInput, Select, Tabs, Toolbar } from "../../components/admin/Filters";
import { productsApi, type AdminProduct, type StockFilter } from "../../frontApisRoute/products";
import { useAdminStats } from "./lib/AdminStats";
import { useCategories } from "./lib/useCategories";
import { useLowStockThreshold } from "./lib/settings";
import { useResource } from "../../hooks/useResource";
import { stockState } from "./lib/stock";
import { downloadCsv } from "./lib/csv";
import { date, money, number, relativeDate } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";


function InlineStock({ product, onSaved }: { product: AdminProduct; onSaved: (product: AdminProduct) => void }) {
  const [value, setValue] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);
  const stock = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(stock) && stock >= 0;
  const changed = valid && stock !== product.stock;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    try {
      const result = await productsApi.update(product._id, { stock });
      toast.success(`${result.product.name}: ${number(result.product.stock)} in stock`);
      onSaved(result.product);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.inlineStock} onSubmit={save}>
      <input className={`${ui.input} ${ui.num}`} type="number" min={0} step={1} inputMode="numeric" value={value}
        onChange={(event) => setValue(event.target.value)} aria-label={`Stock for ${product.name}`} aria-invalid={!valid} />
      <button type="submit" className={`${ui.button} ${changed ? ui.primary : ui.secondary} ${ui.small}`} disabled={!changed || saving}>
        {saving ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <CheckIcon aria-hidden="true" />} Save
      </button>
    </form>
  );
}

export default function AdminInventory({ lowStockOnly = false }: { lowStockOnly?: boolean }) {
  const { preferences } = useAdminPreferences();
  const pageSize = preferences.pageSize;
  const threshold = useLowStockThreshold();
  const stats = useAdminStats();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const fallbackStock: StockFilter | "" = lowStockOnly ? "restock" : "";
  const stock = (params.get("stock") ?? fallbackStock) as StockFilter | "";
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "stock_asc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = { q, stock, sort, page, limit: pageSize, lowStockBelow: threshold };
  const products = useResource(`inventory:${JSON.stringify(query)}`, () => productsApi.list(query));
  const counts = stats.products;

  const setFilter = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: key !== "page" });
  };

  const saved = (updated: AdminProduct) => {
    products.update((data) => ({ ...data, products: data.products.map((product) => (product._id === updated._id ? updated : product)) }));
    stats.refresh();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await productsApi.all({ q, stock, sort, lowStockBelow: threshold });
      downloadCsv(lowStockOnly ? "greenfarm-low-stock" : "greenfarm-inventory", ["Product", "Category", "Unit", "Stock", "Status", "Price (GHS)", "Stock value (GHS)", "Last updated"],
        rows.map((product) => [product.name, categories.nameOf(product.category), product.unit, product.stock, stockState(product.stock, threshold), product.price, Math.round(product.price * product.stock * 100) / 100, product.updatedAt]));
      toast.success(`Exported ${number(rows.length)} products`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const tabs: { value: StockFilter | ""; label: string; count?: number }[] = lowStockOnly
    ? [
      { value: "restock", label: "Needs restock", count: counts ? counts.lowStock + counts.outOfStock : undefined },
      { value: "low", label: "Low stock", count: counts?.lowStock },
      { value: "out", label: "Out of stock", count: counts?.outOfStock },
    ]
    : [
      { value: "", label: "All products", count: counts?.total },
      { value: "in", label: "In stock", count: counts?.inStock },
      { value: "low", label: "Low stock", count: counts?.lowStock },
      { value: "out", label: "Out of stock", count: counts?.outOfStock },
    ];

  const columns: Column<AdminProduct>[] = [
    {
      key: "product", header: "Product", primary: true, render: (product) => (
        <div className={ui.productCell}>
          <Thumb src={product.image} />
          <div className={ui.cellStack}>
            <Link to={`/admin/products/${product._id}/edit`} className={ui.cellPrimary} style={{ textDecoration: "none" }}>{product.name}</Link>
            <span className={ui.cellSecondary}>{product.unit} · {categories.nameOf(product.category)}</span>
          </div>
        </div>
      ),
    },
    { key: "current", header: "Current stock", align: "right", render: (product) => <strong className={ui.num}>{number(product.stock)}</strong> },
    { key: "status", header: "Stock status", render: (product) => <StockBadge stock={product.stock} threshold={threshold} /> },
    { key: "value", header: "Stock value", align: "right", render: (product) => <span className={ui.num}>{money(product.price * product.stock)}</span> },
    { key: "updated", header: "Last updated", render: (product) => <span className={ui.cellSecondary} title={date(product.updatedAt, true)}>{relativeDate(product.updatedAt)}</span> },
    { key: "action", header: "Update stock", align: "right", render: (product) => <InlineStock key={`${product._id}:${product.stock}`} product={product} onSaved={saved} /> },
  ];

  const pagination = products.data?.pagination;

  return (
    <>
      <PageHeader
        title={lowStockOnly ? "Low stock" : "Stock management"}
        description={lowStockOnly ? `Products below ${number(threshold)} units, lowest stock first.` : "Track stock levels and restock products."}
        actions={
          <>
            <Link to="/admin/settings" className={`${ui.button} ${ui.ghost}`}><SettingsIcon aria-hidden="true" /> Low-stock limit: {number(threshold)}</Link>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={exportCsv} disabled={exporting || !pagination?.total}>
              {exporting ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />} Export
            </button>
          </>
        }
      />

      {!lowStockOnly && (
        <section className={ui.statGrid} aria-label="Inventory figures">
          <StatCard label="Units in stock" icon={BoxesIcon} value={counts ? number(counts.stockUnits) : "–"} note={counts ? `Across ${number(counts.total)} products` : undefined} />
          <StatCard label="Stock value" icon={WalletIcon} value={counts ? money(counts.inventoryValue) : "–"} note="At current selling prices" />
          <StatCard label="Low stock" icon={AlertTriangleIcon} tone="warning" to="/admin/inventory/low-stock" value={counts ? number(counts.lowStock) : "–"} note={`Fewer than ${number(threshold)} units`} />
          <StatCard label="Out of stock" icon={PackageXIcon} tone="danger" to="/admin/inventory?stock=out" value={counts ? number(counts.outOfStock) : "–"} note="Can't be ordered" />
        </section>
      )}

      <Panel flush>
        <Tabs label="Stock status" value={stock} onChange={(value) => setFilter("stock", value === fallbackStock ? "" : value)} tabs={tabs} />
        <Toolbar>
          <SearchInput label="Search products" placeholder="Search products" value={q} onChange={(value) => setFilter("q", value)} />
          <Select label="Sort" value={sort} onChange={(value) => setFilter("sort", value === "stock_asc" ? "" : value)} options={[
            { value: "stock_asc", label: "Lowest stock first" }, { value: "updated", label: "Recently updated" }, { value: "name", label: "Name A–Z" },
          ]} />
        </Toolbar>
        <DataTable
          label={lowStockOnly ? "Low stock products" : "Stock levels"}
          columns={columns}
          rows={products.data?.products ?? null}
          rowKey={(product) => product._id}
          loading={products.loading}
          error={products.error}
          onRetry={products.reload}
          rowTone={(product) => { const state = stockState(product.stock, threshold); return state === "out" ? "danger" : state === "low" ? "warning" : undefined; }}
          empty={lowStockOnly && !q
            ? { icon: PackageCheckIcon, title: "Nothing needs restocking", text: `Every product has at least ${number(threshold)} units in stock.` }
            : { icon: BoxesIcon, title: "No products found", text: "Try another search or stock filter." }}
        />
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pageSize} noun="products" onChange={(next) => setFilter("page", String(next))} />}
      </Panel>
    </>
  );
}
