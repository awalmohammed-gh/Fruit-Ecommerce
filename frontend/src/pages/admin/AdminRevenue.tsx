import { useMemo, useState } from "react";
import { BanknoteIcon, CalendarDaysIcon, CalendarIcon, CalendarRangeIcon, DownloadIcon, TrendingUpIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import StatCard from "../../components/admin/StatCard";
import DataTable, { type Column } from "../../components/admin/DataTable";
import RevenueChart from "../../components/admin/RevenueChart";
import Thumb from "../../components/admin/Thumb";
import { StockBadge } from "../../components/admin/Badge";
import { Segmented } from "../../components/admin/Filters";
import { EmptyState, ErrorState } from "../../components/admin/States";
import { adminOrdersApi, type ProductRevenue } from "../../frontApisRoute/orders";
import { useLowStockThreshold } from "./lib/settings";
import { useResource } from "../../hooks/useResource";
import { labelBuckets, type Granularity } from "./lib/orders";
import { downloadCsv } from "./lib/csv";
import { change, money, number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

const CHART_LABEL: Record<Granularity, string> = { daily: "Daily revenue, last 14 days", weekly: "Weekly revenue, last 12 weeks", monthly: "Monthly revenue, last 12 months" };

export default function AdminRevenue() {
  const threshold = useLowStockThreshold();
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const summary = useResource("order-summary", () => adminOrdersApi.summary());
  const revenue = useResource(`revenue:${granularity}`, () => adminOrdersApi.revenue(granularity));
  // Units and revenue per product, with live stock so shortages show up next to sales.
  const byProduct = useResource("product-revenue", () => adminOrdersApi.productRevenue());
  const series = useMemo(() => labelBuckets(revenue.data?.buckets ?? [], granularity), [revenue.data, granularity]);
  const figures = summary.data?.summary;
  const rows = byProduct.data?.products ?? [];
  const productTotal = rows.reduce((sum, row) => sum + row.revenue, 0);

  const exportCsv = () => {
    downloadCsv("greenfarm-revenue-by-product", ["Product", "Unit", "Units sold", "Revenue (GHS)", "Share of product revenue %", "Stock remaining"],
      rows.map((row) => [row.name, row.unit, row.units, row.revenue, productTotal ? Math.round((row.revenue / productTotal) * 1000) / 10 : 0, row.stock ?? ""]));
    toast.success(`Exported ${number(rows.length)} products`);
  };

  const columns: Column<ProductRevenue>[] = [
    {
      key: "product", header: "Product", primary: true, render: (row) => (
        <div className={ui.productCell}><Thumb src={row.image} size={40} /><div className={ui.cellStack}><span className={ui.cellPrimary}>{row.name}</span><span className={ui.cellSecondary}>{row.unit}</span></div></div>
      ),
    },
    { key: "units", header: "Units sold", align: "right", render: (row) => <span className={ui.num}>{number(row.units)}</span> },
    { key: "revenue", header: "Revenue", align: "right", render: (row) => <strong className={ui.num}>{money(row.revenue)}</strong> },
    {
      key: "stock", header: "Stock remaining", render: (row) => row.stock === null
        ? <span className={ui.cellSecondary} title="This product has since been deleted">No longer sold</span>
        : <div className={styles.badgeRow}><span className={ui.num}>{number(row.stock)}</span><StockBadge stock={row.stock} threshold={threshold} /></div>,
    },
    {
      key: "performance", header: "Performance", render: (row) => {
        const share = productTotal ? (row.revenue / productTotal) * 100 : 0;
        return <div className={styles.share} aria-label={`${share.toFixed(1)}% of product revenue`}><div className={styles.shareTrack}><div className={styles.shareFill} style={{ width: `${share}%` }} /></div><span>{share.toFixed(0)}%</span></div>;
      },
    },
  ];

  const loading = <span className={ui.skeletonCell} style={{ width: 100, height: 26 }} aria-label="Loading" />;
  const figure = (value: number | undefined) => (figures && value !== undefined ? money(value) : loading);

  return (
    <>
      <PageHeader
        title="Revenue"
        description="Sales performance over time and by product. Cancelled orders are excluded."
        actions={<button type="button" className={`${ui.button} ${ui.secondary}`} onClick={exportCsv} disabled={!rows.length}><DownloadIcon aria-hidden="true" /> Export</button>}
      />
      {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}

      <section className={ui.statGrid} aria-label="Revenue figures">
        <StatCard label="Total revenue" icon={BanknoteIcon} value={figure(figures?.allTime.revenue)} note={figures ? `${number(figures.allTime.orders)} orders` : undefined} />
        <StatCard label="Today" icon={CalendarIcon} value={figure(figures?.periods.today.revenue)}
          delta={figures ? change(figures.periods.today.revenue, figures.periods.yesterday.revenue) : null} deltaLabel="vs yesterday" />
        <StatCard label="This week" icon={CalendarRangeIcon} value={figure(figures?.periods.thisWeek.revenue)}
          delta={figures ? change(figures.periods.thisWeek.revenue, figures.periods.lastWeek.revenue) : null} deltaLabel="vs last week" />
        <StatCard label="This month" icon={CalendarDaysIcon} value={figure(figures?.periods.thisMonth.revenue)}
          delta={figures ? change(figures.periods.thisMonth.revenue, figures.periods.lastMonth.revenue) : null} deltaLabel="vs last month" />
      </section>

      <div className={styles.mainGrid}>
        <Panel id="revenue-trend" title="Revenue trend" description="Order totals by period"
          actions={<Segmented label="Period" value={granularity} onChange={setGranularity} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />}>
          {revenue.error ? <ErrorState message={revenue.error} onRetry={revenue.reload} /> : <RevenueChart buckets={series} label={CHART_LABEL[granularity]} />}
        </Panel>

        <Panel flush id="top-products" title="Top-performing products" description="By revenue">
          {byProduct.error ? <ErrorState message={byProduct.error} onRetry={byProduct.reload} />
            : !byProduct.data ? <div style={{ padding: 20 }}><span className={ui.skeletonCell} /></div>
            : rows.length === 0 ? <EmptyState icon={TrendingUpIcon} title="No sales yet" text="Best sellers appear here once orders come in." />
            : (
              <ol className={styles.list}>
                {rows.slice(0, 5).map((row, index) => (
                  <li key={row.product} className={styles.listItem}>
                    <span className={styles.rank}>{index + 1}</span>
                    <Thumb src={row.image} size={36} />
                    <div className={styles.listMain}><span className={styles.name}>{row.name}</span><span className={styles.meta}>{number(row.units)} sold</span></div>
                    <strong className={ui.num} style={{ fontSize: 13 }}>{money(row.revenue)}</strong>
                  </li>
                ))}
              </ol>
            )}
        </Panel>
      </div>

      <Panel flush id="product-revenue" title="Revenue per product" description="Every product that has sold, with the stock left to sell">
        <DataTable label="Revenue per product" columns={columns} rows={byProduct.data ? rows : null} rowKey={(row) => row.product}
          loading={byProduct.loading} error={byProduct.error} onRetry={byProduct.reload}
          rowTone={(row) => (row.stock === null ? undefined : row.stock <= 0 ? "danger" : row.stock < threshold ? "warning" : undefined)}
          empty={{ icon: TrendingUpIcon, title: "No product sales yet", text: "Revenue per product appears once orders are placed." }} />
      </Panel>
    </>
  );
}
