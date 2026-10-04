import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Modal from "../../../components/admin/Modal";
import { deliveryAdminApi, type ApplicationStatus } from "../../../frontApisRoute/delivery";
import ui from "../../../components/admin/ui.module.css";

interface Props {
  partner: { _id: string; fullName: string; applicationStatus: ApplicationStatus };
  action: ApplicationStatus;
  onClose: () => void;
  onDone: () => void;
}

function copyFor(action: ApplicationStatus, from: ApplicationStatus, name: string) {
  if (action === "Approved" && from === "Suspended") {
    return { title: "Reactivate partner?", confirm: "Reactivate", tone: "primary", text: `${name} can sign in to the Delivery Partner Dashboard and be assigned deliveries again.` } as const;
  }
  if (action === "Approved") {
    return { title: "Approve application?", confirm: "Approve", tone: "primary", text: `${name} can then activate their account with their email and reference code at /delivery-partner/status, sign in, and be assigned deliveries.` } as const;
  }
  if (action === "Rejected") {
    return { title: "Reject application?", confirm: "Reject", tone: "danger", reason: "Reason (shown to the applicant)", text: `${name} will see that their application wasn't approved. They can correct their details and apply again.` } as const;
  }
  return { title: "Suspend partner?", confirm: "Suspend", tone: "danger", reason: "Reason (shown to the partner)", text: `${name} loses access to the Delivery Partner Dashboard immediately and won't be offered new deliveries. Deliveries they're carrying stay with them until you reassign them.` } as const;
}

// Confirms an application status change. Reject and suspend take an optional reason the partner can see.
export default function ReviewDialog({ partner, action, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = copyFor(action, partner.applicationStatus, partner.fullName);
  const reasonLabel = "reason" in copy ? copy.reason : null;

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await deliveryAdminApi.review(partner._id, action, reason.trim());
      toast.success(result.message);
      if (result.openDeliveries) toast.warning(`${result.openDeliveries} open ${result.openDeliveries === 1 ? "delivery is" : "deliveries are"} still with ${partner.fullName}`, { description: `Reassign ${result.openDeliveries === 1 ? "it" : "them"} from Delivery Assignments.`, duration: 7000 });
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the application");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={busy} title={copy.title}
      footer={
        <>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={`${ui.button} ${copy.tone === "danger" ? ui.danger : ui.primary}`} onClick={confirm} disabled={busy}>
            {busy && <LoaderCircleIcon className={ui.spin} aria-hidden="true" />}{copy.confirm}
          </button>
        </>
      }>
      <p className={ui.hint} style={{ fontSize: 13.5, color: "var(--gf-text)", margin: 0 }}>{copy.text}</p>
      {reasonLabel && (
        <div className={ui.field} style={{ marginTop: 16 }}>
          <label className={ui.label} htmlFor="review-reason">{reasonLabel} <span className={ui.optional}>optional</span></label>
          <textarea id="review-reason" className={ui.textarea} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} style={{ minHeight: 80 }} />
        </div>
      )}
    </Modal>
  );
}
