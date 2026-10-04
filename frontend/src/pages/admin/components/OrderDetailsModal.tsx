import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "../../../components/toast/toast";
import { RepeatIcon, TruckIcon } from "lucide-react";
import Modal from "../../../components/admin/Modal";
import Thumb from "../../../components/admin/Thumb";
import { DeliveryStatusBadge, OrderStatusBadge, PaymentBadge } from "../../../components/admin/Badge";
import { Notice } from "../../../components/admin/States";
import type { Order, OrderStatus } from "../../../types";
import { adminOrdersApi } from "../../../frontApisRoute/orders";
import { useResource } from "../../../hooks/useResource";
import { MANAGEMENT_STATUSES, READY_FOR_DELIVERY } from "../lib/orders";
import { TRANSPORT_LABEL } from "../../../utils/delivery";
import { date, money } from "../lib/format";
import AssignPartnerModal from "./AssignPartnerModal";
import ui from "../../../components/admin/ui.module.css";
import styles from "../pages.module.css";

interface OrderDetailsModalProps {
  order: Order;
  onClose: () => void;
  onChange: (order: Order) => void;
}

const FINAL: OrderStatus[] = ["Delivered", "Cancelled"];

export default function OrderDetailsModal({ order: initial, onClose, onChange }: OrderDetailsModalProps) {
  // List rows don't carry the delivery attempts, so load the full order.
  const [version, setVersion] = useState(0);
  const detail = useResource(`admin-order:${initial._id}:${version}`, () => adminOrdersApi.get(initial._id));
  const order = detail.data?.order ?? initial;
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const locked = FINAL.includes(order.status);
  const address = order.shippingAddress;
  const partner = order.deliveryPartner;
  const canAssign = !locked && READY_FOR_DELIVERY.includes(order.status);
  const attemptFailed = !partner && (order.deliveryStatus === "Failed Delivery" || order.deliveryStatus === "Declined");
  const lastAttempt = order.assignments?.[order.assignments.length - 1];
  // Management sets the early steps; Assigned onwards follows the partner.
  const statusOptions = MANAGEMENT_STATUSES.includes(order.status) ? MANAGEMENT_STATUSES : [order.status, ...MANAGEMENT_STATUSES.filter((status) => status === "Cancelled")];

  const updated = (next: Order) => { setVersion((value) => value + 1); onChange(next); };

  const changeStatus = async (status: OrderStatus) => {
    if (status === order.status) return;
    if (status === "Cancelled" && !window.confirm(`Cancel order #${order.number}? Its items go back into stock${partner ? ` and ${partner.fullName}'s delivery is closed` : ""}.`)) return;
    setBusy(true);
    try {
      const result = await adminOrdersApi.setStatus(order._id, status);
      updated(result.order);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the order");
    } finally {
      setBusy(false);
    }
  };

  if (assigning) {
    return <AssignPartnerModal order={order} currentPartnerId={partner?._id} onClose={() => setAssigning(false)} onAssigned={(next) => { setAssigning(false); updated(next); }} />;
  }

  return (
    <Modal open wide onClose={onClose} busy={busy} title={`Order #${order.number}`} description={`Placed ${date(order.createdAt, true)}`}
      footer={<button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={busy}>Close</button>}>
      <div className={styles.stack20}>
        <div className={styles.badgeRow}>
          <OrderStatusBadge status={order.status} />
          <PaymentBadge paid={order.isPaid} />
          {order.deliveryStatus && <DeliveryStatusBadge status={order.deliveryStatus} />}
          <span className={ui.hint}>Cash on delivery{order.paidAt ? ` · paid ${date(order.paidAt, true)}` : ""}</span>
        </div>
        {order.cancelReason && <p className={ui.hint}>Cancellation reason: {order.cancelReason}</p>}
        {attemptFailed && !locked && (
          <Notice tone="error">
            {order.deliveryStatus === "Declined" ? "The delivery partner declined this delivery" : "The last delivery attempt failed"}
            {lastAttempt?.failureReason ? ` (${lastAttempt.failureReason})` : ""}. Assign a partner to try again.
          </Notice>
        )}

        <div className={styles.detailGrid}>
          <div className={styles.detailBlock}>
            <h3>Customer</h3>
            <p className={ui.cellPrimary}>{order.customer.name}</p>
            <p className={ui.cellSecondary}>{order.customer.email}{order.customer.phone ? ` · ${order.customer.phone}` : ""}</p>
          </div>
          <div className={styles.detailBlock}>
            <h3>Deliver to</h3>
            <p className={ui.cellPrimary}>{address.label} · {address.fullName}</p>
            <p className={ui.cellSecondary}>{[address.addressLine1, address.addressLine2, address.city, address.region].filter(Boolean).join(", ")}</p>
            <p className={ui.cellSecondary}>{address.phone}{address.digitalAddress ? ` · ${address.digitalAddress}` : ""}{address.landmark ? ` · Near ${address.landmark}` : ""}</p>
          </div>
        </div>

        <div className={ui.panel}>
          <table className={ui.table}>
            <caption className="sr-only">Items in this order</caption>
            <thead><tr><th scope="col">Item</th><th scope="col" className={ui.alignRight}>Qty</th><th scope="col" className={ui.alignRight}>Total</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.product}>
                  <td><div className={ui.productCell}><Thumb src={item.image} size={36} /><div className={ui.cellStack}><span className={ui.cellPrimary}>{item.name}</span><span className={ui.cellSecondary}>{money(item.price)} · {item.unit}</span></div></div></td>
                  <td className={`${ui.alignRight} ${ui.num}`}>{item.quantity}</td>
                  <td className={`${ui.alignRight} ${ui.num}`}>{money(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className={styles.totals}>
            <div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            <div><dt>Delivery</dt><dd>{order.deliveryFee ? money(order.deliveryFee) : "Free"}</dd></div>
            <div><dt>Tax</dt><dd>{money(order.tax)}</dd></div>
            <div className={styles.totalRow}><dt>Total</dt><dd>{money(order.total)}</dd></div>
          </dl>
        </div>

        <div className={styles.detailGrid}>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="order-status">Order status</label>
            <select id="order-status" className={ui.select} value={order.status} disabled={locked || busy} onChange={(event) => changeStatus(event.target.value as OrderStatus)}>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <span className={ui.hint}>{locked ? `${order.status} orders can't change.` : "Assigned, Out for Delivery and Delivered update automatically as the delivery partner works."}</span>
          </div>
          <div className={ui.field}>
            <span className={ui.label}>Delivery partner</span>
            {partner ? (
              <div className={styles.inlineStatus}>
                <span className={styles.avatar} aria-hidden="true">{partner.fullName.charAt(0)}</span>
                <span className={ui.cellStack}>
                  <span className={ui.cellPrimary}>{partner.fullName}</span>
                  <span className={ui.cellSecondary}>{partner.phone} · {TRANSPORT_LABEL[partner.transportType]}</span>
                </span>
              </div>
            ) : <span className={ui.hint}>{order.status === "Order Placed" ? "Confirm the order before assigning a delivery partner." : locked ? "No partner." : "Not assigned yet."}</span>}
            {canAssign && (
              <div>
                <button type="button" className={`${ui.button} ${partner ? ui.secondary : ui.primary} ${ui.small}`} onClick={() => setAssigning(true)} disabled={busy}>
                  {partner ? <><RepeatIcon aria-hidden="true" /> Reassign delivery</> : <><TruckIcon aria-hidden="true" /> Assign Delivery Partner</>}
                </button>
              </div>
            )}
          </div>
        </div>

        {!!order.assignments?.length && (
          <div>
            <h3 className={styles.subheading}>Delivery attempts</h3>
            <ol className={styles.attempts}>
              {order.assignments.map((attempt, index) => (
                <li key={attempt._id} className={styles.attempt}>
                  <span className={ui.cellStack}>
                    <span className={ui.cellPrimary}>{index + 1}. {attempt.deliveryPartner?.fullName ?? "Unknown partner"}</span>
                    <span className={ui.cellSecondary}>Assigned {date(attempt.assignedAt, true)}{attempt.failureReason ? ` · ${attempt.failureReason}` : ""}</span>
                  </span>
                  <DeliveryStatusBadge status={attempt.status} />
                </li>
              ))}
            </ol>
            <Link to={`/admin/delivery/assignments?q=${order.number}`} className={styles.textLink} style={{ marginTop: 10 }}>Track in Delivery Assignments</Link>
          </div>
        )}

        {order.statusHistory.length > 0 && (
          <div>
            <h3 className={styles.subheading}>Order timeline</h3>
            <ol className={styles.timeline}>
              {[...order.statusHistory].reverse().map((entry, index) => (
                <li key={`${entry.timestamp}-${index}`}>
                  <span className={ui.cellPrimary}>{entry.status}</span>
                  <span className={ui.cellSecondary}>{entry.note} · {date(entry.timestamp, true)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Modal>
  );
}
