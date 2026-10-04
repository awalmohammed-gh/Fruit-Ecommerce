import { useState } from "react";
import { BanIcon, CheckIcon, KeyRoundIcon, LoaderCircleIcon, RotateCcwIcon, XIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Modal from "../../../components/admin/Modal";
import { ApplicationStatusBadge } from "../../../components/admin/Badge";
import { ErrorState, LoadingState, Notice } from "../../../components/admin/States";
import { deliveryAdminApi, type ApplicationStatus } from "../../../frontApisRoute/delivery";
import { useResource } from "../../../hooks/useResource";
import { AVAILABILITY_LABEL, ID_LABEL, TRANSPORT_LABEL, ageFrom } from "../../../utils/delivery";
import { date, number } from "../lib/format";
import ReviewDialog from "./ReviewDialog";
import ui from "../../../components/admin/ui.module.css";
import styles from "../pages.module.css";

interface Props { id: string; onClose: () => void; onChanged: () => void }

// Everything an applicant submitted, plus the review actions their current status allows.
export default function ApplicationModal({ id, onClose, onChanged }: Props) {
  const [version, setVersion] = useState(0);
  const detail = useResource(`application:${id}:${version}`, () => deliveryAdminApi.application(id));
  const [action, setAction] = useState<ApplicationStatus | null>(null);
  const application = detail.data?.application;
  const status = application?.applicationStatus;
  const [issuing, setIssuing] = useState(false);
  const [newCode, setNewCode] = useState("");

  // For an approved applicant who lost their reference code. Shown once; read it to them by phone.
  const issueCode = async () => {
    if (!application || !window.confirm(`Issue a new activation code for ${application.fullName}? Their old code stops working.`)) return;
    setIssuing(true);
    try {
      setNewCode((await deliveryAdminApi.activationCode(application._id)).reference);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to issue a code");
    } finally {
      setIssuing(false);
    }
  };

  const actions = !application ? null : (
    <>
      <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>Close</button>
      {status === "Pending" && (
        <>
          <button type="button" className={`${ui.button} ${ui.dangerOutline}`} onClick={() => setAction("Rejected")}><XIcon aria-hidden="true" /> Reject</button>
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => setAction("Approved")}><CheckIcon aria-hidden="true" /> Approve</button>
        </>
      )}
      {status === "Approved" && !application.accountActivated && !newCode && (
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={issueCode} disabled={issuing}>
          {issuing ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <KeyRoundIcon aria-hidden="true" />} New activation code
        </button>
      )}
      {status === "Approved" && <button type="button" className={`${ui.button} ${ui.dangerOutline}`} onClick={() => setAction("Suspended")}><BanIcon aria-hidden="true" /> Suspend</button>}
      {status === "Suspended" && <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => setAction("Approved")}><RotateCcwIcon aria-hidden="true" /> Reactivate</button>}
    </>
  );

  const block = (title: string, facts: [string, string][]) => (
    <div className={styles.detailBlock}>
      <h3>{title}</h3>
      <dl className={styles.factList}>
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
      </dl>
    </div>
  );

  return (
    <>
      <Modal open={!action} wide onClose={onClose} title={application ? application.fullName : "Delivery partner application"}
        description={application ? `Applied ${date(application.createdAt, true)}` : undefined} footer={actions}>
        {detail.error && !application ? <ErrorState message={detail.error} onRetry={detail.reload} />
          : !application ? <LoadingState label="Loading application" />
          : (
            <div className={styles.stack20}>
              <div className={styles.badgeRow}>
                <ApplicationStatusBadge status={application.applicationStatus} activated={application.accountActivated} />
                {application.approvedAt && <span className={ui.hint}>Partner since {date(application.approvedAt)}</span>}
                {(status === "Approved" || status === "Suspended") && (
                  <span className={ui.hint}>· {number(application.activeDeliveries)} active, {number(application.completedDeliveries)} delivered</span>
                )}
              </div>
              {status === "Approved" && !application.accountActivated && !newCode && (
                <Notice tone="info">Approved, but {application.fullName} hasn't activated their account yet, so they can't sign in or be assigned deliveries. They activate at /delivery-partner/status with their email and reference code.</Notice>
              )}
              {newCode && (
                <Notice tone="info">New activation code: <strong className={ui.mono} style={{ fontSize: 15 }}>{newCode}</strong>. Give it to {application.fullName} along with their email ({application.email}). It won't be shown again.</Notice>
              )}
              {status === "Rejected" && application.rejectionReason && <p className={ui.hint}>Rejection reason: {application.rejectionReason}</p>}
              {status === "Suspended" && application.suspensionReason && <p className={ui.hint}>Suspension reason: {application.suspensionReason}</p>}

              <div className={styles.detailGrid}>
                {block("Personal details", [
                  ["Email", application.email], ["Phone", application.phone],
                  ["Date of birth", `${date(application.dateOfBirth)} (${ageFrom(application.dateOfBirth)})`], ["Availability", AVAILABILITY_LABEL[application.availability]],
                ])}
                {block("Location", [
                  ["Region", application.region], ["City / area", application.city],
                  ["Address", application.address], ["GhanaPost GPS", application.digitalAddress],
                ])}
                {block("Transport", [
                  ["Means of transport", TRANSPORT_LABEL[application.transportType]], ["Vehicle", application.vehicleType],
                  ["Registration", application.vehicleRegistration], ["Driver's licence", application.licenseNumber],
                ])}
                {block("Identification & emergency contact", [
                  ["ID type", ID_LABEL[application.idType]], ["ID number", application.idNumber],
                  ["Emergency contact", application.emergencyContact.name], ["Contact phone", application.emergencyContact.phone],
                ])}
              </div>
              {application.notes && (
                <div className={styles.detailBlock}><h3>Notes from the applicant</h3><p>{application.notes}</p></div>
              )}
              {application.statusHistory.length > 0 && (
                <div>
                  <h3 className={styles.subheading}>Review history</h3>
                  <ol className={styles.timeline}>
                    {[...application.statusHistory].reverse().map((entry, index) => (
                      <li key={`${entry.at}-${index}`}>
                        <span className={ui.cellPrimary}>{entry.status}</span>
                        <span className={ui.cellSecondary}>{entry.note} · {entry.by === "applicant" ? "by the applicant" : entry.by} · {date(entry.at, true)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
      </Modal>
      {action && application && (
        <ReviewDialog partner={application} action={action} onClose={() => setAction(null)}
          onDone={() => { setAction(null); setVersion((value) => value + 1); onChanged(); }} />
      )}
    </>
  );
}
