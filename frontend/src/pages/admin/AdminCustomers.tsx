import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DownloadIcon, EyeIcon, LoaderCircleIcon, MapPinIcon, UserCheckIcon, UserXIcon, UsersIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Pagination from "../../components/admin/Pagination";
import ActionMenu from "../../components/admin/ActionMenu";
import Modal, { ConfirmDialog } from "../../components/admin/Modal";
import Badge, { ActiveBadge, OrderStatusBadge } from "../../components/admin/Badge";
import { SearchInput, Tabs, Toolbar } from "../../components/admin/Filters";
import { ErrorState, LoadingState } from "../../components/admin/States";
import { customersApi, type Customer } from "../../frontApisRoute/customers";
import { useAdminStats } from "./lib/AdminStats";
import { useResource } from "../../hooks/useResource";
import { downloadCsv } from "./lib/csv";
import { date, money, number } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";

const avatarStyle = { display: "grid", placeItems: "center", width: 36, height: 36, flexShrink: 0, borderRadius: "50%", background: "var(--gf-accent-soft)", color: "var(--gf-accent)", fontSize: 13, fontWeight: 650 } as const;

// Sample orders belong to made-up shoppers, so they're never attributed to real customers.

function CustomerModal({ id, onClose, onToggle }: { id: string; onClose: () => void; onToggle: (customer: Customer) => void }) {
  const detail = useResource(`customer:${id}`, () => customersApi.get(id));
  const customer = detail.data?.customer;
  const history = detail.data?.orders ?? [];

  return (
    <Modal open wide onClose={onClose} title={customer?.fullName ?? "Customer"} description={customer ? `Customer since ${date(customer.createdAt)}` : undefined}
      footer={
        <>
          {customer && (
            <button type="button" className={`${ui.button} ${customer.isActive ? ui.dangerOutline : ui.secondary}`} onClick={() => onToggle(customer)}>
              {customer.isActive ? <><UserXIcon aria-hidden="true" /> Deactivate</> : <><UserCheckIcon aria-hidden="true" /> Activate</>}
            </button>
          )}
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={onClose}>Close</button>
        </>
      }>
      {detail.error ? <ErrorState message={detail.error} onRetry={detail.reload} /> : !detail.data || !customer ? <LoadingState label="Loading customer" /> : (
        <div className={styles.stack20}>
          <div className={styles.detailGrid}>
            <div className={styles.detailBlock}>
              <h3>Contact</h3>
              <p className={ui.cellPrimary}>{customer.email}</p>
              <p className={ui.cellSecondary}>{customer.phone || "No phone number"}</p>
            </div>
            <div className={styles.detailBlock}>
              <h3>Account</h3>
              <div><ActiveBadge active={customer.isActive} /></div>
              <p className={ui.cellSecondary}>Joined {date(customer.createdAt)} · updated {date(customer.updatedAt)}</p>
            </div>
            <div className={styles.detailBlock}>
              <h3>Orders</h3>
              <p className={ui.cellPrimary}>{number(customer.orders)}</p>
              <p className={ui.cellSecondary}>Orders placed</p>
            </div>
            <div className={styles.detailBlock}>
              <h3>Total spent</h3>
              <p className={ui.cellPrimary}>{money(customer.totalSpent)}</p>
              <p className={ui.cellSecondary}>Excluding cancelled orders</p>
            </div>
          </div>

          <div>
            <h3 className={styles.subheading}>Saved addresses</h3>
            {detail.data.addresses.length === 0 ? <p className={ui.hint}>No saved addresses yet.</p> : (
              <div className={styles.addressList}>
                {detail.data.addresses.map((address) => (
                  <div key={address._id} className={styles.detailBlock}>
                    <div className={styles.badgeRow}><MapPinIcon size={14} aria-hidden="true" /><span className={ui.cellPrimary}>{address.label}</span>{address.isDefault && <Badge tone="success" dot={false}>Default</Badge>}</div>
                    <p className={ui.cellSecondary}>{[address.addressLine1, address.addressLine2, address.city, address.region].filter(Boolean).join(", ")}</p>
                    <p className={ui.cellSecondary}>{address.fullName} · {address.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className={styles.subheading}>Order history</h3>
            {history.length === 0 ? <p className={ui.hint}>No orders yet.</p> : (
                <ul className={styles.list}>
                  {history.map((order) => (
                    <li key={order._id} className={styles.listItem} style={{ paddingLeft: 0, paddingRight: 0 }}>
                      <div className={styles.listMain}><span className={`${styles.name} ${ui.mono}`}>#{order.number}</span><span className={styles.meta}>{date(order.createdAt)} · {money(order.total)}</span></div>
                      <OrderStatusBadge status={order.status} />
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminCustomers() {
  const { preferences } = useAdminPreferences();
  const pageSize = preferences.pageSize;
  const stats = useAdminStats();
  const [params, setParams] = useSearchParams();
  const [viewing, setViewing] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const q = params.get("q") ?? "";
  const status = (params.get("status") ?? "") as "active" | "inactive" | "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = { q, status, page, limit: pageSize };
  const customers = useResource(`customers:${JSON.stringify(query)}`, () => customersApi.list(query));
  const counts = stats.customers;

  const setFilter = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: key !== "page" });
  };

  const toggle = async () => {
    if (!toggling) return;
    setBusy(true);
    try {
      const result = await customersApi.setStatus(toggling._id, !toggling.isActive);
      toast.success(`${result.customer.fullName} ${result.customer.isActive ? "activated" : "deactivated"}`);
      setToggling(null);
      setViewing(null);
      customers.reload();
      stats.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the customer");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await customersApi.all({ q, status });
      downloadCsv("greenfarm-customers", ["Name", "Email", "Phone", "Status", "Joined"], rows.map((customer) => [customer.fullName, customer.email, customer.phone, customer.isActive ? "Active" : "Inactive", customer.createdAt]));
      toast.success(`Exported ${number(rows.length)} customers`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: "customer", header: "Customer", primary: true, render: (customer) => (
        <div className={ui.productCell} style={{ minWidth: 180 }}>
          <span style={avatarStyle} aria-hidden="true">{customer.fullName.charAt(0).toUpperCase()}</span>
          <button type="button" className={styles.linkCell} onClick={() => setViewing(customer._id)}>{customer.fullName}</button>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (customer) => <span style={{ overflowWrap: "anywhere" }}>{customer.email}</span> },
    { key: "phone", header: "Phone", render: (customer) => customer.phone || <span className={ui.cellSecondary}>–</span> },
    { key: "orders", header: "Orders", align: "right", render: (customer) => <span className={ui.num}>{number(customer.orders)}</span> },
    { key: "spent", header: "Total spent", align: "right", render: (customer) => <span className={ui.num}>{money(customer.totalSpent)}</span> },
    { key: "status", header: "Status", render: (customer) => <ActiveBadge active={customer.isActive} /> },
    { key: "joined", header: "Joined", render: (customer) => <span className={ui.num}>{date(customer.createdAt)}</span> },
    {
      key: "actions", header: "", align: "right", render: (customer) => (
        <ActionMenu label={`Actions for ${customer.fullName}`} actions={[
          { label: "View details", icon: EyeIcon, onSelect: () => setViewing(customer._id) },
          customer.isActive
            ? { label: "Deactivate account", icon: UserXIcon, danger: true, separated: true, onSelect: () => setToggling(customer) }
            : { label: "Activate account", icon: UserCheckIcon, separated: true, onSelect: () => setToggling(customer) },
        ]} />
      ),
    },
  ];

  const pagination = customers.data?.pagination;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer accounts, contact details and account status."
        count={counts ? `${number(counts.total)} customers` : undefined}
        actions={
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={exportCsv} disabled={exporting || !pagination?.total}>
            {exporting ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />} Export
          </button>
        }
      />

      <Panel flush>
        <Tabs label="Account status" value={status} onChange={(value) => setFilter("status", value)} tabs={[
          { value: "", label: "All", count: counts?.total },
          { value: "active", label: "Active", count: counts?.active },
          { value: "inactive", label: "Inactive", count: counts?.inactive },
        ]} />
        <Toolbar>
          <SearchInput label="Search customers" placeholder="Name, email or phone" value={q} onChange={(value) => setFilter("q", value)} />
        </Toolbar>
        <DataTable
          label="Customers"
          columns={columns}
          rows={customers.data?.customers ?? null}
          rowKey={(customer) => customer._id}
          loading={customers.loading}
          error={customers.error}
          onRetry={customers.reload}
          empty={q || status
            ? { icon: UsersIcon, title: "No customers match", text: "Try a different name, email or status." }
            : { icon: UsersIcon, title: "No customers yet", text: "Accounts appear here when shoppers sign up." }}
        />
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pageSize} noun="customers" onChange={(next) => setFilter("page", String(next))} />}
      </Panel>

      {viewing && <CustomerModal id={viewing} onClose={() => setViewing(null)} onToggle={setToggling} />}
      <ConfirmDialog
        open={!!toggling}
        busy={busy}
        onClose={() => setToggling(null)}
        onConfirm={toggle}
        tone={toggling?.isActive ? "danger" : "primary"}
        title={toggling?.isActive ? "Deactivate this account?" : "Activate this account?"}
        confirmLabel={toggling?.isActive ? "Deactivate" : "Activate"}
        message={toggling?.isActive
          ? <><strong>{toggling.fullName}</strong> will be signed out everywhere and won't be able to sign in until you activate the account again.</>
          : <><strong>{toggling?.fullName}</strong> will be able to sign in and place orders again.</>}
      />
    </>
  );
}
