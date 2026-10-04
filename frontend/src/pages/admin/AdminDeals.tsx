import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useState } from "react";
import { BadgePercentIcon, PencilIcon, PlusIcon, TagIcon, TrophyIcon, XCircleIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import StatCard from "../../components/admin/StatCard";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Pagination from "../../components/admin/Pagination";
import ActionMenu from "../../components/admin/ActionMenu";
import Modal, { ConfirmDialog } from "../../components/admin/Modal";
import Thumb from "../../components/admin/Thumb";
import Badge, { StockBadge } from "../../components/admin/Badge";
import { SearchInput, Toolbar } from "../../components/admin/Filters";
import { EmptyState, ErrorState } from "../../components/admin/States";
import { productsApi, type AdminProduct } from "../../frontApisRoute/products";
import PricingModal from "./components/PricingModal";
import { useAdminStats } from "./lib/AdminStats";
import { useLowStockThreshold } from "./lib/settings";
import { useResource } from "../../hooks/useResource";
import { money, number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";


function ProductPicker({ onPick, onClose }: { onPick: (product: AdminProduct) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const results = useResource(`deal-picker:${q}`, () => productsApi.list({ q, limit: 8, sort: q ? "name" : "updated" }));
  return (
    <Modal open onClose={onClose} title="Create a deal" description="Choose the product to put on sale."
      footer={<button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>Cancel</button>}>
      <div className={styles.stack16}>
        <SearchInput label="Search products" placeholder="Search products" value={q} onChange={setQ} />
        {results.error ? <ErrorState message={results.error} onRetry={results.reload} />
          : !results.data ? <span className={ui.skeletonCell} />
          : results.data.products.length === 0 ? <EmptyState title="No products found" text="Try another name." />
          : (
            <ul className={`${styles.list} ${ui.panel}`}>
              {results.data.products.map((product) => (
                <li key={product._id} className={styles.listItem}>
                  <Thumb src={product.image} size={36} />
                  <div className={styles.listMain}>
                    <span className={styles.name}>{product.name}</span>
                    <span className={styles.meta}>{money(product.price)} · {product.unit}{product.discount > 0 ? ` · already ${product.discount}% off` : ""}</span>
                  </div>
                  <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={() => onPick(product)}>{product.discount > 0 ? "Edit" : "Select"}</button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </Modal>
  );
}

export default function AdminDeals() {
  const { preferences } = useAdminPreferences();
  const pageSize = preferences.pageSize;
  const threshold = useLowStockThreshold();
  const stats = useAdminStats();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState(false);
  const [pricing, setPricing] = useState<AdminProduct | null>(null);
  const [ending, setEnding] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const query = { q, onSale: true, sort: "discount", page, limit: pageSize };
  const deals = useResource(`deals:${JSON.stringify(query)}`, () => productsApi.list(query));
  const counts = stats.products;
  const soldOut = useResource(`deals-out:${counts?.onSale ?? 0}`, () => productsApi.list({ onSale: true, stock: "out", limit: 1 }));

  const refresh = () => { deals.reload(); stats.refresh(); soldOut.reload(); };

  const endDeal = async () => {
    if (!ending) return;
    setBusy(true);
    try {
      await productsApi.update(ending._id, { originalPrice: null });
      toast.success(`Deal on ${ending.name} ended`);
      setEnding(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to end the deal");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminProduct>[] = [
    {
      key: "product", header: "Product", primary: true, render: (product) => (
        <div className={ui.productCell}>
          <Thumb src={product.image} />
          <div className={ui.cellStack}><span className={ui.cellPrimary}>{product.name}</span><span className={ui.cellSecondary}>{product.unit}</span></div>
        </div>
      ),
    },
    { key: "was", header: "Original price", align: "right", render: (product) => <span className={`${ui.num} ${ui.cellSecondary}`} style={{ textDecoration: "line-through" }}>{money(product.originalPrice)}</span> },
    { key: "now", header: "Sale price", align: "right", render: (product) => <strong className={ui.num}>{money(product.price)}</strong> },
    { key: "discount", header: "Discount", render: (product) => <Badge tone="deal" dot={false}>{product.discount}% off</Badge> },
    { key: "saving", header: "Customer saves", align: "right", render: (product) => <span className={ui.num}>{money(product.originalPrice - product.price)}</span> },
    { key: "stock", header: "Stock", render: (product) => <StockBadge stock={product.stock} threshold={threshold} /> },
    {
      key: "actions", header: "", align: "right", render: (product) => (
        <ActionMenu label={`Actions for ${product.name}`} actions={[
          { label: "Edit deal", icon: PencilIcon, onSelect: () => setPricing(product) },
          { label: "End deal", icon: XCircleIcon, danger: true, separated: true, onSelect: () => setEnding(product) },
        ]} />
      ),
    },
  ];

  const pagination = deals.data?.pagination;

  return (
    <>
      <PageHeader
        title="Deals & discounts"
        description="Products on sale. Discounts are calculated from the original and sale price."
        actions={<button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => setPicking(true)}><PlusIcon aria-hidden="true" /> New deal</button>}
      />

      <section className={ui.statGrid} aria-label="Deal figures">
        <StatCard label="Active deals" icon={TagIcon} value={counts ? number(counts.onSale) : "–"} note={counts ? `of ${number(counts.total)} products` : undefined} />
        <StatCard label="Average discount" icon={BadgePercentIcon} value={counts ? (counts.averageDiscount ? `${Math.round(counts.averageDiscount)}%` : "–") : "–"} note="Across active deals" />
        <StatCard label="Biggest discount" icon={TrophyIcon} value={counts ? (counts.biggestDiscount ? `${counts.biggestDiscount}%` : "–") : "–"} note="Single product" />
        <StatCard label="Deals out of stock" icon={XCircleIcon} tone="warning" to="/admin/products?stock=out" value={soldOut.data ? number(soldOut.data.pagination.total) : "–"} note="Customers can't buy these" />
      </section>

      <Panel flush>
        <Toolbar>
          <SearchInput label="Search deals" placeholder="Search products on sale" value={q} onChange={(value) => { setQ(value); setPage(1); }} />
        </Toolbar>
        <DataTable
          label="Active deals"
          columns={columns}
          rows={deals.data?.products ?? null}
          rowKey={(product) => product._id}
          loading={deals.loading}
          error={deals.error}
          onRetry={deals.reload}
          rowTone={(product) => (product.stock <= 0 ? "danger" : undefined)}
          empty={q
            ? { icon: TagIcon, title: "No deals match", text: "Try another product name." }
            : { icon: TagIcon, title: "No active deals", text: "Put a product on sale to show a discount badge in the store.", action: <button type="button" className={`${ui.button} ${ui.primary} ${ui.small}`} onClick={() => setPicking(true)}><PlusIcon aria-hidden="true" /> New deal</button> }}
        />
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pageSize} noun="deals" onChange={setPage} />}
      </Panel>

      {picking && <ProductPicker onClose={() => setPicking(false)} onPick={(product) => { setPicking(false); setPricing(product); }} />}
      {pricing && <PricingModal product={pricing} onClose={() => setPricing(null)} onSaved={() => { setPricing(null); refresh(); }} />}
      <ConfirmDialog open={!!ending} busy={busy} onClose={() => setEnding(null)} onConfirm={endDeal} title="End this deal?" confirmLabel="End deal"
        message={<><strong>{ending?.name}</strong> will stay at {ending ? money(ending.price) : ""} with no discount. To restore the old price, edit the product.</>} />
    </>
  );
}
