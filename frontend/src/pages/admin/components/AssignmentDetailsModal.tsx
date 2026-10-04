import { useState } from "react";
import { RepeatIcon, TruckIcon } from "lucide-react";
import Modal from "../../../components/admin/Modal";
import { DeliveryStatusBadge, OrderStatusBadge, PaymentBadge } from "../../../components/admin/Badge";
import { ErrorState, LoadingState, Notice } from "../../../components/admin/States";
import { deliveryAdminApi } from "../../../frontApisRoute/delivery";
import { useResource } from "../../../hooks/useResource";
import { TRANSPORT_LABEL } from "../../../utils/delivery";
import { date, money, time } from "../lib/format";
import AssignPartnerModal from "./AssignPartnerModal";
import ui from "../../../components/admin/ui.module.css";
import styles from "../pages.module.css";

interface Props { id: string; onClose: () => void; onChanged: () => void }


// One delivery: order, destination, partner, timeline and every earlier attempt on the same order.
export default function AssignmentDetailsModal({ id, onClose, onChanged }: Props) {
  const [version, setVersion] = useState(0);
  const detail = useResource(`assignment:${id}:${version}`, () => deliveryAdminApi.assignment(id));
  const [reassigning, setReassigning] = useState(false);
  const assignment = detail.data?.assignment;
  const attempts = detail.data?.attempts ?? [];
  const order = assignment?.order;
  const partner = assignment?.deliveryPartner;
  const latest = attempts[attempts.length - 1]?._id === id;
  // Reassign the current attempt, or hand a failed/declined one to someone new, while the order is still open.
  const canReassign = !!order && latest && order.status !== "Delivered" && order.status !== "Cancelled" && assignment?.status !== "Delivered";

  if (reassigning && order) {
    return (
      <AssignPartnerModal order={order} currentPartnerId={assignment?.active ? partner?._id : null} onClose={() => setReassigning(false)}
        onAssigned={() => { setReassigning(false); onChanged(); onClose(); }} />
    );
  }

  return (
    <Modal open wide onClose={onClose} title={order ? `Delivery for order #${order.number}` : "Delivery"}
      description={assignment ? `Assigned ${date(assignment.assignedAt, true)} by ${assignment.assignedBy}` : undefined}
      footer={
        <>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>Close</button>
          {canReassign && (
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => setReassigning(true)}>
              {assignment?.active ? <><RepeatIcon aria-hidden="true" /> Reassign delivery</> : <><TruckIcon aria-hidden="true" /> Assign new partner</>}
            </button>
          )}
        </>
      }>
      {detail.error && !assignment ? <ErrorState message={detail.error} onRetry={() => setVersion((value) => value + 1)} />
        : !assignment ? <LoadingState label="Loading delivery" />
        : (
          <div className={styles.stack20}>
            <div className={styles.badgeRow}>
              <DeliveryStatusBadge status={assignment.status} />
              {order && <OrderStatusBadge status={order.status} />}
              {order && <PaymentBadge paid={order.isPaid} />}
            </div>
            {assignment.failureReason && (
              <Notice tone={assignment.status === "Failed Delivery" || assignment.status === "Declined" ? "error" : "info"}>
                {assignment.status === "Declined" ? "Declined" : "Failed"}: {assignment.failureReason}
                {canReassign && !assignment.active && " · Assign a new partner to try again."}
              </Notice>
            )}

            <div className={styles.detailGrid}>
              <div className={styles.detailBlock}>
                <h3>Order</h3>
                {order ? (
                  <>
                    <p className={ui.cellPrimary}>#{order.number} · {money(order.total)}</p>
                    <p className={ui.cellSecondary}>{order.customer.name} · Cash on delivery</p>
                    {order.items && <p className={ui.cellSecondary}>{order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ")}</p>}
                  </>
                ) : <p className={ui.cellSecondary}>The order no longer exists.</p>}
              </div>
              <div className={styles.detailBlock}>
                <h3>Destination</h3>
                {order && (
                  <>
                    <p className={ui.cellPrimary}>{order.shippingAddress.fullName} · {order.shippingAddress.phone}</p>
                    <p className={ui.cellSecondary}>{[order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.region].filter(Boolean).join(", ")}</p>
                    {(order.shippingAddress.digitalAddress || order.shippingAddress.landmark) && (
                      <p className={ui.cellSecondary}>{[order.shippingAddress.digitalAddress, order.shippingAddress.landmark && `Near ${order.shippingAddress.landmark}`].filter(Boolean).join(" · ")}</p>
                    )}
                  </>
                )}
              </div>
              <div className={styles.detailBlock}>
                <h3>Delivery partner</h3>
                {partner ? (
                  <>
                    <p className={ui.cellPrimary}>{partner.fullName}</p>
                    <p className={ui.cellSecondary}>{[partner.phone, partner.transportType && TRANSPORT_LABEL[partner.transportType], partner.vehicleType].filter(Boolean).join(" · ")}</p>
                    {partner.region && <p className={ui.cellSecondary}>Based in {partner.region}</p>}
                  </>
                ) : <p className={ui.cellSecondary}>Partner record not found.</p>}
              </div>
              <div className={styles.detailBlock}>
                <h3>Notes for the partner</h3>
                <p className={assignment.notes ? undefined : ui.cellSecondary}>{assignment.notes || "No notes were added."}</p>
              </div>
            </div>

            <div>
              <h3 className={styles.subheading}>Delivery timeline</h3>
              <ol className={styles.timeline}>
                {[...assignment.history].reverse().map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <span className={ui.cellPrimary}>{entry.status} <span className={styles.timelineTime}>· {time(entry.at)}</span></span>
                    <span className={ui.cellSecondary}>{date(entry.at)} · {entry.by === "partner" ? "by the partner" : "by management"}{entry.note ? ` · ${entry.note}` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>

            {attempts.length > 1 && (
              <div>
                <h3 className={styles.subheading}>All delivery attempts for this order</h3>
                <ol className={styles.attempts}>
                  {attempts.map((attempt, index) => (
                    <li key={attempt._id} className={styles.attempt} aria-current={attempt._id === id ? "true" : undefined}>
                      <span className={ui.cellStack}>
                        <span className={ui.cellPrimary}>{index + 1}. {attempt.deliveryPartner?.fullName ?? "Unknown partner"}{attempt._id === id ? " (this delivery)" : ""}</span>
                        <span className={ui.cellSecondary}>{date(attempt.assignedAt, true)}{attempt.failureReason ? ` · ${attempt.failureReason}` : ""}</span>
                      </span>
                      <DeliveryStatusBadge status={attempt.status} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
    </Modal>
  );
}
