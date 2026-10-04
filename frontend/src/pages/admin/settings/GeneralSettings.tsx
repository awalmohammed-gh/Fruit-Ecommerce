import { useState, type FormEvent, type ReactNode } from "react";
import toast from "../../../components/toast/toast";
import Panel from "../../../components/admin/Panel";
import Badge from "../../../components/admin/Badge";
import { apiRequest } from "../../../frontApisRoute/client";
import { DEFAULT_LOW_STOCK, setLowStockThreshold, useLowStockThreshold } from "../lib/settings";
import { useResource } from "../../../hooks/useResource";
import { money } from "../lib/format";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <div className={s.rowLabel}><strong>{label}</strong>{hint && <span>{hint}</span>}</div>
      <div className={s.rowValue}>{children}</div>
    </div>
  );
}

// The admin account, how the dashboard flags stock, and how the store is set up.
export default function GeneralSettings() {
  const threshold = useLowStockThreshold();
  const [draft, setDraft] = useState(String(threshold));
  const health = useResource("health", () => apiRequest<{ status: string }>("/health"));
  const draftValue = Number(draft);
  const draftValid = Number.isInteger(draftValue) && draftValue >= 1 && draftValue <= 100000;

  const saveThreshold = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftValid) return;
    setLowStockThreshold(draftValue);
    toast.success(`Low stock now means fewer than ${draftValue} units`);
  };

  return (
    <div className={s.generalLayout}>
      <Panel id="inventory" title="Inventory" description="Controls how stock problems are flagged across the dashboard.">
        <Row label="Low-stock limit" hint={`Products with fewer units are flagged as low stock. Saved in this browser only. Default ${DEFAULT_LOW_STOCK}.`}>
          <form onSubmit={saveThreshold} className={s.inlineForm}>
            <input className={`${ui.input} ${ui.num}`} type="number" min={1} step={1} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Low-stock limit in units" aria-invalid={!draftValid} />
            <button type="submit" className={`${ui.button} ${ui.primary} ${ui.small}`} disabled={!draftValid || draftValue === threshold}>Save</button>
          </form>
        </Row>
      </Panel>

      <Panel id="system" title="Store connection" description="Current service and payment information.">
        <Row label="Currency" hint="Matches the storefront's price formatting.">Ghana cedi (GHS), e.g. {money(1250)}</Row>
        <Row label="Store service">
          {health.loading ? <span className={ui.hint}>Checking…</span> : health.data?.status === "ok" ? <Badge tone="success">Connected</Badge> : <Badge tone="danger">Unreachable</Badge>}
        </Row>
        <Row label="Store records" hint="Products, orders, deliveries, reviews and storefront content.">Saved on the server</Row>
        <Row label="Payments" hint="Card payments need a payment provider, which isn't connected yet.">Cash on delivery</Row>
      </Panel>
    </div>
  );
}
