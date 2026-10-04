import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EyeIcon, RouteIcon } from "lucide-react";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Pagination from "../../components/admin/Pagination";
import { DeliveryStatusBadge } from "../../components/admin/Badge";
import { SearchInput, Tabs, Toolbar } from "../../components/admin/Filters";
import AssignmentDetailsModal from "./components/AssignmentDetailsModal";
import { deliveryAdminApi, type Assignment, type TrackingGroup } from "../../frontApisRoute/delivery";
import { useResource } from "../../hooks/useResource";
import { date, number, relativeDate, time } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

const REFRESH_EVERY = 30_000;

// Live view of every delivery partners are carrying, and how each one ended.
export default function AdminDeliveryAssignments() {
  const { preferences } = useAdminPreferences();
  const pageSize = preferences.pageSize;
  const [params, setParams] = useSearchParams();
  const [viewing, setViewing] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const status = (params.get("status") ?? "") as TrackingGroup | "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = { status, q, page, limit: pageSize };
  const assignments = useResource(`assignments:${JSON.stringify(query)}:${tick}`, () => deliveryAdminApi.assignments(query));
  const counts = assignments.data?.counts;

  // Partners update deliveries from the road, so keep the table current.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), REFRESH_EVERY);
    return () => clearInterval(timer);
  }, []);

  const setFilter = (key: string, value: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    return next;
  }, { replace: key !== "page" });

  const columns: Column<Assignment>[] = [
    { key: "order", header: "Order ID", primary: true, render: (row) => <button type="button" className={`${styles.linkCell} ${ui.mono}`} onClick={() => setViewing(row._id)}>#{row.order?.number ?? "—"}</button> },
    { key: "customer", header: "Customer", render: (row) => <span className={ui.cellPrimary}>{row.order?.customer.name ?? "—"}</span> },
    { key: "partner", header: "Delivery partner", render: (row) => row.deliveryPartner ? <div className={ui.cellStack}><span>{row.deliveryPartner.fullName}</span><span className={ui.cellSecondary}>{row.deliveryPartner.phone}</span></div> : "—" },
    { key: "destination", header: "Destination", render: (row) => row.order ? <div className={ui.cellStack}><span>{row.order.shippingAddress.city}</span><span className={ui.cellSecondary}>{row.order.shippingAddress.region}</span></div> : "—" },
    { key: "assigned", header: "Assigned", render: (row) => <div className={ui.cellStack}><span className={ui.num}>{date(row.assignedAt)}</span><span className={ui.cellSecondary}>{time(row.assignedAt)}</span></div> },
    { key: "status", header: "Current status", render: (row) => <DeliveryStatusBadge status={row.status} /> },
    { key: "updated", header: "Last updated", render: (row) => <div className={ui.cellStack}><span>{relativeDate(row.updatedAt)}</span><span className={ui.cellSecondary}>{time(row.updatedAt)}</span></div> },
    { key: "actions", header: "", align: "right", render: (row) => <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setViewing(row._id)}><EyeIcon aria-hidden="true" /> View</button> },
  ];

  const pagination = assignments.data?.pagination;
  const inProgress = counts ? counts.assigned + counts["picked-up"] + counts["on-the-way"] : undefined;
  return (
    <>
      <PageHeader title="Delivery assignments" description="Track every delivery from assignment to drop-off. Assign deliveries from an order's details on the Orders page."
        count={inProgress !== undefined ? `${number(inProgress)} in progress` : undefined} />

      <Panel flush>
        <Tabs label="Delivery status" value={status} onChange={(value) => setFilter("status", value)} tabs={[
          { value: "", label: "All", count: counts?.all },
          { value: "assigned", label: "Assigned", count: counts?.assigned },
          { value: "picked-up", label: "Picked Up", count: counts?.["picked-up"] },
          { value: "on-the-way", label: "On The Way", count: counts?.["on-the-way"] },
          { value: "delivered", label: "Delivered", count: counts?.delivered },
          { value: "failed", label: "Failed", count: counts?.failed },
          { value: "closed", label: "Reassigned / cancelled", count: counts?.closed },
        ]} />
        <Toolbar end={q ? <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setFilter("q", "")}>Clear search</button> : undefined}>
          <SearchInput label="Search deliveries" placeholder="Order number, customer or partner" value={q} onChange={(value) => setFilter("q", value)} />
        </Toolbar>
        <DataTable label="Delivery assignments" columns={columns} rows={assignments.data?.assignments ?? null} rowKey={(row) => row._id}
          loading={assignments.loading && !assignments.data} error={assignments.error} onRetry={assignments.reload}
          rowTone={(row) => (row.status === "Failed Delivery" || row.status === "Declined" ? "danger" : undefined)}
          empty={status || q ? { icon: RouteIcon, title: "No deliveries match", text: "Try another status or search." }
            : { icon: RouteIcon, title: "No deliveries yet", text: "Assign a confirmed order to a delivery partner from the Orders page." }} />
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pageSize} noun="deliveries" onChange={(next) => setFilter("page", String(next))} />}
      </Panel>

      {viewing && <AssignmentDetailsModal id={viewing} onClose={() => setViewing(null)} onChanged={() => setTick((value) => value + 1)} />}
    </>
  );
}
