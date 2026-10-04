import { useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircleIcon, TruckIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Modal from "../../../components/admin/Modal";
import Badge from "../../../components/admin/Badge";
import { EmptyState, ErrorState, LoadingState } from "../../../components/admin/States";
import { deliveryAdminApi } from "../../../frontApisRoute/delivery";
import { adminOrdersApi } from "../../../frontApisRoute/orders";
import type { Order } from "../../../types";
import { useResource } from "../../../hooks/useResource";
import { TRANSPORT_LABEL } from "../../../utils/delivery";
import { number } from "../lib/format";
import ui from "../../../components/admin/ui.module.css";
import styles from "../pages.module.css";

interface Props {
  order: { _id: string; number: string; shippingAddress: { city: string; region: string } };
  currentPartnerId?: string | null;
  onClose: () => void;
  onAssigned: (order: Order) => void;
}

// Only approved partners who have activated their account are offered; pending, rejected, suspended and not-yet-activated ones never appear here.
export default function AssignPartnerModal({ order, currentPartnerId, onClose, onAssigned }: Props) {
  const partners = useResource("available-partners", () => deliveryAdminApi.partners(true));
  const [selected, setSelected] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const list = partners.data?.partners ?? [];
  const destination = order.shippingAddress;

  const assign = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await adminOrdersApi.assign(order._id, selected, notes.trim());
      toast.success(result.message);
      onAssigned(result.order);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to assign the delivery");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={busy} title={currentPartnerId ? "Reassign delivery" : "Assign delivery partner"}
      description={<>Order #{order.number} to {[destination.city, destination.region].filter(Boolean).join(", ")}</>}
      footer={
        <>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={assign} disabled={busy || !selected}>
            {busy ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <TruckIcon aria-hidden="true" />} Assign Delivery
          </button>
        </>
      }>
      {partners.error && !partners.data ? <ErrorState message={partners.error} onRetry={partners.reload} />
        : !partners.data ? <LoadingState label="Loading delivery partners" />
        : !list.length ? (
          <EmptyState icon={TruckIcon} title="No partners available" text={<>Only approved, active partners can take deliveries. Review new applicants under <Link to="/admin/delivery/applications" onClick={onClose}>Delivery Applications</Link>.</>} />
        ) : (
          <div className={styles.stack16}>
            <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <legend className={ui.label} style={{ marginBottom: 8 }}>Choose a partner <span className={ui.optional}>· least busy first</span></legend>
              <div className={styles.choiceList}>
                {list.map((partner) => {
                  const current = partner._id === currentPartnerId;
                  return (
                    <label key={partner._id} className={styles.choice}>
                      <input type="radio" name="assign-partner" value={partner._id} checked={selected === partner._id} disabled={current} onChange={() => setSelected(partner._id)} />
                      <span className={styles.avatar} aria-hidden="true">{partner.fullName.charAt(0)}</span>
                      <span className={styles.choiceMain}>
                        <span className={ui.cellPrimary}>{partner.fullName}</span>
                        <span className={styles.choiceMeta}>
                          <span>{partner.phone}</span>
                          <span>{partner.city}, {partner.region}</span>
                          <span>{TRANSPORT_LABEL[partner.transportType]}</span>
                        </span>
                      </span>
                      <span className={styles.choiceAside}>
                        {current ? <Badge tone="neutral" dot={false}>Current partner</Badge>
                          : partner.region === destination.region ? <Badge tone="success" dot={false}>Same region</Badge> : null}
                        <span>{number(partner.activeDeliveries)} active {partner.activeDeliveries === 1 ? "delivery" : "deliveries"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className={ui.field}>
              <label className={ui.label} htmlFor="assign-notes">Delivery notes for the partner <span className={ui.optional}>optional</span></label>
              <textarea id="assign-notes" className={ui.textarea} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} style={{ minHeight: 72 }}
                placeholder="e.g. Fragile items. Call the customer before arriving." />
            </div>
          </div>
        )}
    </Modal>
  );
}
