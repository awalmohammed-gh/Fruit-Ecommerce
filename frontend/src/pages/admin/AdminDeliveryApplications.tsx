import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheckIcon, EyeIcon } from "lucide-react";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Pagination from "../../components/admin/Pagination";
import { ApplicationStatusBadge } from "../../components/admin/Badge";
import { SearchInput, Tabs, Toolbar } from "../../components/admin/Filters";
import ApplicationModal from "./components/ApplicationModal";
import { deliveryAdminApi, type ApplicationRow, type ApplicationStatus } from "../../frontApisRoute/delivery";
import { useResource } from "../../hooks/useResource";
import { useAdminStats } from "./lib/AdminStats";
import { TRANSPORT_LABEL } from "../../utils/delivery";
import { date, number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

const EMPTY: Record<ApplicationStatus | "all", string> = {
  Pending: "No applications waiting for review", Approved: "No approved applications", Rejected: "No rejected applications",
  Suspended: "No suspended partners", all: "No applications yet",
};

export default function AdminDeliveryApplications() {
  const { preferences } = useAdminPreferences();
  const pageSize = preferences.pageSize;
  const [params, setParams] = useSearchParams();
  const stats = useAdminStats();
  const [viewing, setViewing] = useState<string | null>(null);
  // Pending is the work queue, so it's the default tab.
  const tab = (params.get("status") ?? "Pending") as ApplicationStatus | "all";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = { status: tab === "all" ? "" as const : tab, q, page, limit: pageSize };
  const applications = useResource(`applications:${JSON.stringify(query)}`, () => deliveryAdminApi.applications(query));
  const counts = applications.data?.counts;

  const setFilter = (key: string, value: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    return next;
  }, { replace: key !== "page" });

  const columns: Column<ApplicationRow>[] = [
    {
      key: "applicant", header: "Applicant", primary: true, render: (row) => (
        <div className={ui.productCell} style={{ minWidth: 200 }}>
          <span className={styles.avatar} aria-hidden="true">{row.fullName.charAt(0)}</span>
          <div className={ui.cellStack}>
            <button type="button" className={styles.linkCell} onClick={() => setViewing(row._id)}>{row.fullName}</button>
            <span className={ui.cellSecondary}>{row.email}</span>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (row) => <span className={ui.num}>{row.phone}</span> },
    { key: "region", header: "Region", render: (row) => <div className={ui.cellStack}><span>{row.region}</span><span className={ui.cellSecondary}>{row.city}</span></div> },
    { key: "transport", header: "Transport", render: (row) => <div className={ui.cellStack}><span>{TRANSPORT_LABEL[row.transportType]}</span>{row.vehicleType && <span className={ui.cellSecondary}>{row.vehicleType}</span>}</div> },
    { key: "date", header: "Applied", render: (row) => <span className={ui.num}>{date(row.createdAt)}</span> },
    { key: "status", header: "Status", render: (row) => <ApplicationStatusBadge status={row.applicationStatus} activated={row.accountActivated} /> },
    {
      key: "actions", header: "", align: "right", render: (row) => (
        <button type="button" className={`${ui.button} ${row.applicationStatus === "Pending" ? ui.primary : ui.ghost} ${ui.small}`} onClick={() => setViewing(row._id)}>
          <EyeIcon aria-hidden="true" /> {row.applicationStatus === "Pending" ? "Review" : "View"}
        </button>
      ),
    },
  ];

  const pagination = applications.data?.pagination;
  return (
    <>
      <PageHeader title="Delivery applications" description="Review people who want to deliver for GreenFarm. Only approved applicants can open the Delivery Partner Dashboard."
        count={counts ? `${number(counts.Pending)} waiting for review` : undefined} />

      <Panel flush>
        <Tabs label="Application status" value={tab} onChange={(value) => setFilter("status", value === "Pending" ? "" : value)} tabs={[
          { value: "Pending", label: "Pending", count: counts?.Pending },
          { value: "Approved", label: "Approved", count: counts?.Approved },
          { value: "Rejected", label: "Rejected", count: counts?.Rejected },
          { value: "Suspended", label: "Suspended", count: counts?.Suspended },
          { value: "all", label: "All", count: counts?.all },
        ]} />
        <Toolbar end={q ? <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setFilter("q", "")}>Clear search</button> : undefined}>
          <SearchInput label="Search applications" placeholder="Name, email or phone" value={q} onChange={(value) => setFilter("q", value)} />
        </Toolbar>
        <DataTable label="Delivery partner applications" columns={columns} rows={applications.data?.applications ?? null} rowKey={(row) => row._id}
          loading={applications.loading} error={applications.error} onRetry={applications.reload}
          empty={q ? { icon: ClipboardCheckIcon, title: "No applications match", text: "Try a different name, email or phone number." }
            : { icon: ClipboardCheckIcon, title: EMPTY[tab], text: tab === "Pending" ? "New applications from /delivery-partner/apply appear here." : undefined }} />
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pageSize} noun="applications" onChange={(next) => setFilter("page", String(next))} />}
      </Panel>

      {viewing && <ApplicationModal id={viewing} onClose={() => setViewing(null)} onChanged={() => { applications.reload(); stats.refresh(); }} />}
    </>
  );
}
