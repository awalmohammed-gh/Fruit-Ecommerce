import { useState } from "react";
import { BoxesIcon, DownloadIcon, FolderTreeIcon, LoaderCircleIcon, PackageIcon, ShoppingBagIcon, TrendingUpIcon, UsersIcon, type LucideIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Badge from "../../components/admin/Badge";
import { productsApi } from "../../frontApisRoute/products";
import { customersApi } from "../../frontApisRoute/customers";
import { categoriesApi, labelFromSlug } from "../../frontApisRoute/categories";
import { useAdminStats } from "./lib/AdminStats";
import { useLowStockThreshold } from "./lib/settings";
import { adminOrdersApi } from "../../frontApisRoute/orders";
import { stockState } from "./lib/stock";
import { downloadCsv } from "./lib/csv";
import { number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

interface Report { id: string; title: string; description: string; icon: LucideIcon; rows?: number; run: () => Promise<number> }

export default function AdminReports() {
  const threshold = useLowStockThreshold();
  const { products, customers } = useAdminStats();
  const [running, setRunning] = useState<string | null>(null);

  const categoryName = async () => {
    const { categories } = await categoriesApi.manage();
    const names = new Map(categories.map((category) => [category.slug, category.name]));
    return (slug: string) => names.get(slug) ?? labelFromSlug(slug);
  };

  const reports: Report[] = [
    {
      id: "catalogue", title: "Product catalogue", icon: PackageIcon, rows: products?.total,
      description: "Every product with category, unit, pricing, discount, stock and rating.",
      run: async () => {
        const [rows, nameOf] = await Promise.all([productsApi.all(), categoryName()]);
        downloadCsv("greenfarm-products", ["Name", "Category", "Unit", "Price (GHS)", "Original price (GHS)", "Discount %", "Stock", "Organic", "Rating", "Reviews", "Created", "Updated"],
          rows.map((p) => [p.name, nameOf(p.category), p.unit, p.price, p.originalPrice, p.discount, p.stock, p.isOrganic ? "Yes" : "No", p.rating, p.reviewCount, p.createdAt, p.updatedAt]));
        return rows.length;
      },
    },
    {
      id: "restock", title: "Restock list", icon: BoxesIcon, rows: products ? products.lowStock + products.outOfStock : undefined,
      description: `Products below ${number(threshold)} units, lowest first, with the value of the stock left.`,
      run: async () => {
        const rows = await productsApi.all({ stock: "restock", sort: "stock_asc", lowStockBelow: threshold });
        downloadCsv("greenfarm-restock", ["Product", "Unit", "Stock", "Status", "Price (GHS)", "Stock value (GHS)"],
          rows.map((p) => [p.name, p.unit, p.stock, stockState(p.stock, threshold), p.price, Math.round(p.price * p.stock * 100) / 100]));
        return rows.length;
      },
    },
    {
      id: "categories", title: "Category summary", icon: FolderTreeIcon,
      description: "Each category with its product count, including slugs that have no category record.",
      run: async () => {
        const { categories, unlisted } = await categoriesApi.manage();
        downloadCsv("greenfarm-categories", ["Category", "Slug", "Products", "Has record"],
          [...categories.map((c) => [c.name, c.slug, c.productCount, "Yes"]), ...unlisted.map((c) => [labelFromSlug(c.slug), c.slug, c.productCount, "No"])]);
        return categories.length + unlisted.length;
      },
    },
    {
      id: "customers", title: "Customer list", icon: UsersIcon, rows: customers?.total,
      description: "Customer names, contact details, account status and join dates.",
      run: async () => {
        const rows = await customersApi.all();
        downloadCsv("greenfarm-customers", ["Name", "Email", "Phone", "Status", "Joined"], rows.map((c) => [c.fullName, c.email, c.phone, c.isActive ? "Active" : "Inactive", c.createdAt]));
        return rows.length;
      },
    },
    {
      id: "orders", title: "Orders", icon: ShoppingBagIcon,
      description: "Every order with customer, totals, payment and fulfilment status.",
      run: async () => {
        const rows = await adminOrdersApi.all();
        downloadCsv("greenfarm-orders", ["Order", "Customer", "Email", "Phone", "Date", "Subtotal (GHS)", "Delivery (GHS)", "Tax (GHS)", "Total (GHS)", "Payment", "Status", "Delivery partner", "City", "Region"],
          rows.map((o) => [o.number, o.customer.name, o.customer.email, o.customer.phone, o.createdAt, o.subtotal, o.deliveryFee, o.tax, o.total, o.isPaid ? "Paid" : "Unpaid", o.status, o.deliveryPartner?.fullName ?? "", o.shippingAddress.city, o.shippingAddress.region]));
        return rows.length;
      },
    },
    {
      id: "product-revenue", title: "Revenue by product", icon: TrendingUpIcon,
      description: "Units sold and revenue for each product, excluding cancelled orders.",
      run: async () => {
        const { products: rows } = await adminOrdersApi.productRevenue();
        downloadCsv("greenfarm-revenue-by-product", ["Product", "Unit", "Units sold", "Revenue (GHS)", "Stock remaining"], rows.map((r) => [r.name, r.unit, r.units, r.revenue, r.stock ?? ""]));
        return rows.length;
      },
    },
  ];

  const run = async (report: Report) => {
    setRunning(report.id);
    try {
      const count = await report.run();
      toast.success(`${report.title}: ${number(count)} rows exported`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setRunning(null);
    }
  };

  return (
    <>
      <PageHeader title="Reports" description="Download store data as CSV files for spreadsheets and accounting." />
      <div className={styles.cardGrid}>
        {reports.map((report) => (
          <article key={report.id} className={styles.reportCard}>
            <span className={styles.reportIcon}><report.icon aria-hidden="true" /></span>
            <h3>{report.title}</h3>
            <p>{report.description}</p>
            <div className={styles.reportMeta}>
              <Badge tone="success" dot={false}>Live data</Badge>
              {report.rows !== undefined && <span className={ui.hint}>{number(report.rows)} rows</span>}
              <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} style={{ marginLeft: "auto" }} onClick={() => run(report)} disabled={running !== null}>
                {running === report.id ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />} Export CSV
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
