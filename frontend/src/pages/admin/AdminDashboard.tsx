import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, BanknoteIcon, EyeIcon, FileTextIcon, PackageCheckIcon, PackageIcon, PlusIcon, ShoppingBagIcon, UsersIcon } from "lucide-react";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import StatCard, { Delta, MiniStat, MiniStatRow } from "../../components/admin/StatCard";
import DataTable, { type Column } from "../../components/admin/DataTable";
import RevenueChart from "../../components/admin/RevenueChart";
import Thumb from "../../components/admin/Thumb";
import { OrderStatusBadge, PaymentBadge, StockBadge } from "../../components/admin/Badge";
import { Segmented } from "../../components/admin/Filters";
import { EmptyState, ErrorState } from "../../components/admin/States";
import { productsApi, type AdminProduct } from "../../frontApisRoute/products";
import { adminOrdersApi } from "../../frontApisRoute/orders";
import type { Order } from "../../types";
import StockModal from "./components/StockModal";
import OrderDetailsModal from "./components/OrderDetailsModal";
import { useAdminStats } from "./lib/AdminStats";
import { useLowStockThreshold } from "./lib/settings";
import { useResource } from "../../hooks/useResource";
import { labelBuckets, type Granularity } from "./lib/orders";
import { change, date, money, number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

const PERIOD: Record<Granularity, { current: string; previous: string; chart: string }> = {
  daily: { current: "Today", previous: "Yesterday", chart: "Daily revenue, last 14 days" },
  weekly: { current: "This week", previous: "Last week", chart: "Weekly revenue, last 12 weeks" },
  monthly: { current: "This month", previous: "Last month", chart: "Monthly revenue, last 12 months" },
};

export default function AdminDashboard() {
  const threshold = useLowStockThreshold();
  const stats = useAdminStats();
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [version, setVersion] = useState(0);
  const summary = useResource(`order-summary:${version}`, () => adminOrdersApi.summary());
  const revenue = useResource(`revenue:${granularity}:${version}`, () => adminOrdersApi.revenue(granularity));
  const recent = useResource(`recent-orders:${version}`, () => adminOrdersApi.list({ limit: 6 }));
  const restock = useResource(`dashboard-restock:${threshold}`, () => productsApi.list({ stock: "restock", sort: "stock_asc", limit: 6, lowStockBelow: threshold }));
  const [viewing, setViewing] = useState<Order | null>(null);
  const [restocking, setRestocking] = useState<AdminProduct | null>(null);

  const series = useMemo(() => labelBuckets(revenue.data?.buckets ?? [], granularity), [revenue.data, granularity]);
  const currentPeriod = series[series.length - 1]?.value ?? 0;
  const previousPeriod = series[series.length - 2]?.value ?? 0;
  const figures = summary.data?.summary;
  const products = stats.products;
  const customers = stats.customers;
  const loadingValue = <span className={ui.skeletonCell} style={{ width: 90, height: 26 }} aria-label="Loading" />;

  const orderColumns: Column<Order>[] = [
    { key: "id", header: "Order ID", primary: true, render: (order) => <button type="button" className={`${styles.linkCell} ${ui.mono}`} onClick={() => setViewing(order)}>#{order.number}</button> },
    { key: "customer", header: "Customer", render: (order) => <div className={ui.cellStack}><span className={ui.cellPrimary}>{order.customer.name}</span><span className={ui.cellSecondary}>{order.customer.email}</span></div> },
    { key: "date", header: "Date", render: (order) => <span className={ui.num}>{date(order.createdAt)}</span> },
    { key: "amount", header: "Amount", align: "right", render: (order) => <strong className={ui.num}>{money(order.total)}</strong> },
    { key: "payment", header: "Payment", render: (order) => <PaymentBadge paid={order.isPaid} /> },
    { key: "status", header: "Status", render: (order) => <OrderStatusBadge status={order.status} /> },
    { key: "actions", header: "", align: "right", render: (order) => <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setViewing(order)}><EyeIcon aria-hidden="true" /> View</button> },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Sales, stock and orders that need attention today."
        actions={
          <>
            <Link to="/admin/reports" className={`${ui.button} ${ui.secondary}`}><FileTextIcon aria-hidden="true" /> Reports</Link>
            <Link to="/admin/products/new" className={`${ui.button} ${ui.primary}`}><PlusIcon aria-hidden="true" /> Add product</Link>
          </>
        }
      />

      {stats.error && !products && <ErrorState message={stats.error} onRetry={stats.refresh} />}

      <section className={ui.statGrid} aria-label="Key figures">
        <StatCard label="Total revenue" icon={BanknoteIcon} to="/admin/revenue"
          value={figures ? money(figures.allTime.revenue) : loadingValue}
          delta={figures ? change(figures.periods.thisMonth.revenue, figures.periods.lastMonth.revenue) : null} deltaLabel="vs last month" />
        <StatCard label="Total orders" icon={ShoppingBagIcon} to="/admin/orders"
          value={figures ? number(figures.orders) : loadingValue}
          delta={figures ? change(figures.periods.thisMonth.orders, figures.periods.lastMonth.orders) : null} deltaLabel="vs last month" />
        <StatCard label="Total products" icon={PackageIcon} to="/admin/products"
          value={products ? number(products.total) : loadingValue}
          note={products ? `${number(products.inStock)} available to buy` : undefined} />
        <StatCard label="Total customers" icon={UsersIcon} to="/admin/customers"
          value={customers ? number(customers.total) : loadingValue}
          note={customers ? `${number(customers.joinedThisMonth)} joined this month` : undefined} />
      </section>

      <div className={styles.overviewGrid}>
        <Panel flush title="Orders" description="By fulfilment stage"
          actions={<Link to="/admin/orders" className={styles.textLink}>All orders <ArrowRightIcon aria-hidden="true" /></Link>}>
          <MiniStatRow>
            <MiniStat dot="warning" label="Pending" value={figures ? number(figures.stages.pending) : "–"} note="Awaiting confirmation" to="/admin/orders?stage=pending" />
            <MiniStat dot="success" label="Completed" value={figures ? number(figures.stages.completed) : "–"} note="Delivered" to="/admin/orders?stage=completed" />
            <MiniStat dot="danger" label="Cancelled" value={figures ? number(figures.stages.cancelled) : "–"} note="Not fulfilled" to="/admin/orders?stage=cancelled" />
          </MiniStatRow>
        </Panel>
        <Panel flush title="Inventory" description={`Low stock means fewer than ${number(threshold)} units`}
          actions={<Link to="/admin/inventory" className={styles.textLink}>Stock management <ArrowRightIcon aria-hidden="true" /></Link>}>
          <MiniStatRow>
            <MiniStat dot="success" label="Active products" value={products ? number(products.inStock) : "–"} note="In stock and buyable" to="/admin/inventory?stock=in" />
            <MiniStat dot="warning" label="Low stock" value={products ? number(products.lowStock) : "–"} note="Restock soon" to="/admin/inventory/low-stock" />
            <MiniStat dot="danger" label="Out of stock" value={products ? number(products.outOfStock) : "–"} note="Can't be ordered" to="/admin/inventory?stock=out" />
          </MiniStatRow>
        </Panel>
      </div>

      <div className={styles.mainGrid}>
        <Panel id="revenue" title="Revenue overview" description="Completed and in-progress orders, excluding cancellations"
          actions={<Segmented label="Revenue period" value={granularity} onChange={setGranularity} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />}>
          {revenue.error ? <ErrorState message={revenue.error} onRetry={revenue.reload} /> : (
            <>
              <div className={styles.periodSummary}>
                <div className={styles.periodFigure}>
                  <span>{PERIOD[granularity].current}</span>
                  <div className={styles.figureRow}><strong>{money(currentPeriod)}</strong>{(() => { const value = change(currentPeriod, previousPeriod); return value === null ? null : <Delta value={value} />; })()}</div>
                </div>
                <div className={styles.periodFigure}>
                  <span>{PERIOD[granularity].previous}</span>
                  <strong className={styles.previous}>{money(previousPeriod)}</strong>
                </div>
              </div>
              <RevenueChart buckets={series} label={PERIOD[granularity].chart} />
            </>
          )}
        </Panel>

        <Panel flush id="restock" title="Needs restocking" description="Lowest stock first"
          actions={products && products.lowStock + products.outOfStock > 0 ? <span className={ui.countChip}>{number(products.lowStock + products.outOfStock)}</span> : undefined}>
          {restock.error ? <ErrorState message={restock.error} onRetry={restock.reload} />
            : !restock.data ? <div style={{ padding: 20 }}><span className={ui.skeletonCell} /></div>
            : restock.data.products.length === 0 ? <EmptyState icon={PackageCheckIcon} title="Stock levels look healthy" text={`Every product has at least ${number(threshold)} units.`} />
            : (
              <ul className={styles.list}>
                {restock.data.products.map((product) => (
                  <li key={product._id} className={styles.listItem}>
                    <Thumb src={product.image} size={38} />
                    <div className={styles.listMain}>
                      <span className={styles.name}>{product.name}</span>
                      <span className={styles.meta}>{number(product.stock)} left · {product.unit}</span>
                    </div>
                    <StockBadge stock={product.stock} threshold={threshold} />
                    <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={() => setRestocking(product)}>Restock</button>
                  </li>
                ))}
              </ul>
            )}
          <Link to="/admin/inventory/low-stock" className={styles.panelFooterLink}>View all low stock <ArrowRightIcon aria-hidden="true" /></Link>
        </Panel>
      </div>

      <Panel flush id="recent-orders" title="Recent orders" description="The latest orders placed in your store"
        actions={<Link to="/admin/orders" className={styles.textLink}>View all <ArrowRightIcon aria-hidden="true" /></Link>}>
        <DataTable label="Recent orders" columns={orderColumns} rows={recent.data?.orders ?? null} rowKey={(order) => order._id}
          loading={recent.loading} error={recent.error} onRetry={recent.reload} skeletonRows={4}
          empty={{ icon: ShoppingBagIcon, title: "No orders yet", text: "New orders will appear here as customers check out." }} />
      </Panel>

      {viewing && (
        <OrderDetailsModal order={viewing} onClose={() => setViewing(null)}
          onChange={(updated) => { setViewing(updated); setVersion((value) => value + 1); }} />
      )}
      {restocking && (
        <StockModal product={restocking} threshold={threshold} onClose={() => setRestocking(null)}
          onSaved={() => { setRestocking(null); restock.reload(); stats.refresh(); }} />
      )}
    </>
  );
}
