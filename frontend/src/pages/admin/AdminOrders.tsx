import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DownloadIcon, EyeIcon, LoaderCircleIcon, ShoppingBagIcon, TruckIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Pagination from "../../components/admin/Pagination";
import { DeliveryStatusBadge, OrderStatusBadge, PaymentBadge } from "../../components/admin/Badge";
import { SearchInput, Select, Tabs, Toolbar } from "../../components/admin/Filters";
import OrderDetailsModal from "./components/OrderDetailsModal";
import { adminOrdersApi, type OrderStage } from "../../frontApisRoute/orders";
import type { Order } from "../../types";
import { useResource } from "../../hooks/useResource";
import { downloadCsv } from "./lib/csv";
import { date, money, number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

const itemCount = (order: Order) => order.items.reduce((sum, item) => sum + item.quantity, 0);

export default function AdminOrders() {
  const { preferences } = useAdminPreferences();
  const pageSize = preferences.pageSize;
  const [params, setParams] = useSearchParams();
  const [viewing, setViewing] = useState<Order | null>(null);
  const [exporting, setExporting] = useState(false);
  const stage = (params.get("stage") ?? "") as OrderStage | "";
  const q = params.get("q") ?? "";
  const payment = (params.get("payment") ?? "") as "paid" | "unpaid" | "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = { stage, q, payment, page, limit: pageSize };
  const orders = useResource(`admin-orders:${JSON.stringify(query)}`, () => adminOrdersApi.list(query));
  const counts = orders.data?.counts;

  const setFilter = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: key !== "page" });
  };

  const changed = (updated: Order) => {
    setViewing(updated);
    orders.reload();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await adminOrdersApi.all({ stage, q, payment });
      downloadCsv("greenfarm-orders", ["Order", "Customer", "Email", "Phone", "Date", "Items", "Subtotal (GHS)", "Delivery (GHS)", "Tax (GHS)", "Total (GHS)", "Payment", "Status", "Delivery status", "Delivery partner", "City", "Region"],
        rows.map((order) => [order.number, order.customer.name, order.customer.email, order.customer.phone, order.createdAt, itemCount(order), order.subtotal, order.deliveryFee, order.tax, order.total,
          order.isPaid ? "Paid" : "Unpaid", order.status, order.deliveryStatus ?? "", order.deliveryPartner?.fullName ?? "", order.shippingAddress.city, order.shippingAddress.region]));
      toast.success(`Exported ${number(rows.length)} orders`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<Order>[] = [
    { key: "id", header: "Order ID", primary: true, render: (order) => <button type="button" className={`${styles.linkCell} ${ui.mono}`} onClick={() => setViewing(order)}>#{order.number}</button> },
    { key: "customer", header: "Customer", render: (order) => <div className={ui.cellStack}><span className={ui.cellPrimary}>{order.customer.name}</span><span className={ui.cellSecondary}>{order.customer.email}</span></div> },
    { key: "date", header: "Date", render: (order) => <span className={ui.num}>{date(order.createdAt)}</span> },
    { key: "items", header: "Items", align: "right", render: (order) => <span className={ui.num}>{number(itemCount(order))}</span> },
    { key: "amount", header: "Amount", align: "right", render: (order) => <strong className={ui.num}>{money(order.total)}</strong> },
    { key: "payment", header: "Payment", render: (order) => <PaymentBadge paid={order.isPaid} /> },
    { key: "status", header: "Order status", render: (order) => <OrderStatusBadge status={order.status} /> },
    {
      key: "partner", header: "Delivery", render: (order) => order.deliveryPartner
        ? <div className={ui.cellStack}><span>{order.deliveryPartner.fullName}</span>{order.deliveryStatus ? <DeliveryStatusBadge status={order.deliveryStatus} /> : <span className={ui.cellSecondary}>{order.deliveryPartner.phone}</span>}</div>
        : order.status === "Cancelled" || order.status === "Delivered" ? <span className={ui.cellSecondary}>–</span>
        : order.status === "Order Placed" ? <span className={ui.cellSecondary}>Confirm first</span>
        : <button type="button" className={styles.textLink} onClick={() => setViewing(order)}><TruckIcon aria-hidden="true" /> {order.deliveryStatus === "Failed Delivery" || order.deliveryStatus === "Declined" ? "Reassign" : "Assign"}</button>,
    },
    { key: "actions", header: "", align: "right", render: (order) => <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setViewing(order)}><EyeIcon aria-hidden="true" /> View details</button> },
  ];

  const hasFilters = Boolean(q || payment);
  const pagination = orders.data?.pagination;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Review orders, update their status and assign deliveries."
        count={counts ? `${number(counts.all)} orders` : undefined}
        actions={
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={exportCsv} disabled={exporting || !pagination?.total}>
            {exporting ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />} Export
          </button>
        }
      />

      <Panel flush>
        <Tabs label="Order stage" value={stage} onChange={(value) => setFilter("stage", value)} tabs={[
          { value: "", label: "All", count: counts?.all },
          { value: "pending", label: "Pending", count: counts?.pending },
          { value: "processing", label: "Processing", count: counts?.processing },
          { value: "completed", label: "Completed", count: counts?.completed },
          { value: "cancelled", label: "Cancelled", count: counts?.cancelled },
        ]} />
        <Toolbar end={hasFilters ? <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setParams(stage ? { stage } : {})}>Clear filters</button> : undefined}>
          <SearchInput label="Search orders" placeholder="Order number, customer name or email" value={q} onChange={(value) => setFilter("q", value)} />
          <Select label="Payment" value={payment} onChange={(value) => setFilter("payment", value)} options={[{ value: "", label: "Any payment" }, { value: "paid", label: "Paid" }, { value: "unpaid", label: "Unpaid" }]} />
        </Toolbar>
        <DataTable
          label="Orders"
          columns={columns}
          rows={orders.data?.orders ?? null}
          rowKey={(order) => order._id}
          loading={orders.loading}
          error={orders.error}
          onRetry={orders.reload}
          empty={stage || hasFilters
            ? { icon: ShoppingBagIcon, title: "No orders match", text: "Try another stage, search or payment filter." }
            : { icon: ShoppingBagIcon, title: "No orders yet", text: "Orders appear here as soon as customers check out." }}
        />
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pageSize} noun="orders" onChange={(next) => setFilter("page", String(next))} />}
      </Panel>

      {viewing && <OrderDetailsModal order={viewing} onClose={() => setViewing(null)} onChange={changed} />}
    </>
  );
}
