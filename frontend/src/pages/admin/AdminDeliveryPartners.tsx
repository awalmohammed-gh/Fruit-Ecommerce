import { useState } from "react";
import { Link } from "react-router-dom";
import { BanIcon, ClipboardCheckIcon, EyeIcon, RotateCcwIcon, TruckIcon } from "lucide-react";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import DataTable, { type Column } from "../../components/admin/DataTable";
import ActionMenu from "../../components/admin/ActionMenu";
import { ApplicationStatusBadge } from "../../components/admin/Badge";
import { SearchInput, Tabs, Toolbar } from "../../components/admin/Filters";
import ApplicationModal from "./components/ApplicationModal";
import ReviewDialog from "./components/ReviewDialog";
import { deliveryAdminApi, type PartnerRow } from "../../frontApisRoute/delivery";
import { useResource } from "../../hooks/useResource";
import { useAdminStats } from "./lib/AdminStats";
import { TRANSPORT_LABEL } from "../../utils/delivery";
import { date, number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

// Approved partners and the ones management has suspended. Partner records are never deleted, so history stays intact.
export default function AdminDeliveryPartners() {
  const partners = useResource("admin-partners", () => deliveryAdminApi.partners());
  const stats = useAdminStats();
  const [filter, setFilter] = useState<"" | "Approved" | "Suspended">("");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [changing, setChanging] = useState<PartnerRow | null>(null);
  const list = partners.data?.partners ?? [];
  const term = search.toLowerCase();
  const rows = partners.data
    ? list.filter((partner) => (!filter || partner.applicationStatus === filter)
      && (!term || [partner.fullName, partner.phone, partner.email].some((value) => value.toLowerCase().includes(term))))
    : null;
  const changed = () => { partners.reload(); stats.refresh(); };

  const columns: Column<PartnerRow>[] = [
    {
      key: "partner", header: "Partner", primary: true, render: (partner) => (
        <div className={ui.productCell} style={{ minWidth: 190 }}>
          <span className={styles.avatar} aria-hidden="true">{partner.fullName.charAt(0)}</span>
          <div className={ui.cellStack}>
            <button type="button" className={styles.linkCell} onClick={() => setViewing(partner._id)}>{partner.fullName}</button>
            <span className={ui.cellSecondary}>{partner.approvedAt ? `Since ${date(partner.approvedAt)}` : partner.email}</span>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (partner) => <span className={ui.num}>{partner.phone}</span> },
    { key: "region", header: "Region", render: (partner) => <div className={ui.cellStack}><span>{partner.region}</span><span className={ui.cellSecondary}>{partner.city}</span></div> },
    { key: "transport", header: "Transport", render: (partner) => TRANSPORT_LABEL[partner.transportType] },
    { key: "active", header: "Active deliveries", align: "right", render: (partner) => <strong className={ui.num}>{number(partner.activeDeliveries)}</strong> },
    { key: "completed", header: "Completed", align: "right", render: (partner) => <span className={ui.num}>{number(partner.completedDeliveries)}</span> },
    { key: "status", header: "Status", render: (partner) => <ApplicationStatusBadge status={partner.applicationStatus} activated={partner.accountActivated} /> },
    {
      key: "actions", header: "", align: "right", render: (partner) => (
        <ActionMenu label={`Actions for ${partner.fullName}`} actions={[
          { label: "View partner", icon: EyeIcon, onSelect: () => setViewing(partner._id) },
          partner.applicationStatus === "Approved"
            ? { label: "Suspend partner", icon: BanIcon, danger: true, separated: true, onSelect: () => setChanging(partner) }
            : { label: "Reactivate partner", icon: RotateCcwIcon, separated: true, onSelect: () => setChanging(partner) },
        ]} />
      ),
    },
  ];

  const active = list.filter((partner) => partner.applicationStatus === "Approved").length;
  const awaiting = list.filter((partner) => partner.applicationStatus === "Approved" && !partner.accountActivated).length;
  return (
    <>
      <PageHeader title="Delivery partners" description="Approved partners who can be assigned deliveries. New partners join through Delivery Applications."
        count={partners.data ? `${number(active - awaiting)} active${awaiting ? `, ${number(awaiting)} awaiting activation` : ""}` : undefined}
        actions={<Link to="/admin/delivery/applications" className={`${ui.button} ${ui.secondary}`}><ClipboardCheckIcon aria-hidden="true" /> Review applications</Link>} />

      <Panel flush>
        <Tabs label="Partner status" value={filter} onChange={setFilter} tabs={[
          { value: "", label: "All", count: list.length },
          { value: "Approved", label: "Active", count: active },
          { value: "Suspended", label: "Suspended", count: list.length - active },
        ]} />
        <Toolbar>
          <SearchInput label="Search partners" placeholder="Name, phone or email" value={search} onChange={setSearch} />
        </Toolbar>
        <DataTable label="Delivery partners" columns={columns} rows={rows} rowKey={(partner) => partner._id}
          loading={partners.loading} error={partners.error} onRetry={partners.reload}
          empty={search || filter ? { icon: TruckIcon, title: "No partners match", text: "Try another status or search." }
            : { icon: TruckIcon, title: "No delivery partners yet", text: "Approve an application to add your first partner.",
              action: <Link to="/admin/delivery/applications" className={`${ui.button} ${ui.primary} ${ui.small}`}>Review applications</Link> }} />
      </Panel>

      {viewing && <ApplicationModal id={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
      {changing && (
        <ReviewDialog partner={changing} action={changing.applicationStatus === "Approved" ? "Suspended" : "Approved"}
          onClose={() => setChanging(null)} onDone={() => { setChanging(null); changed(); }} />
      )}
    </>
  );
}
