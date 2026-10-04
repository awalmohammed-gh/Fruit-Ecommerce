import { useState } from "react";
import toast, { errorMessage } from "../toast/toast";
import PortalDialog from "./PortalDialog";
import { inputClass } from "./ApplicationForm";
import { deliveryApi, FAILURE_REASONS, type FailureReason, type PartnerDelivery } from "../../frontApisRoute/delivery";
import { NEXT_ACTION, cedis } from "../../utils/delivery";

type Dialog = { kind: "deliver" | "decline" | "fail"; delivery: PartnerDelivery } | null;
const STEP_DONE = { Accepted: "Delivery accepted", "Picked Up": "Marked as picked up", "On The Way": "Delivery started" } as const;

/**
 * Everything a partner can do to a delivery, shared by the dashboard, the deliveries list and the details page.
 * `next` runs the one step that fits the current status; delivering, declining and failing ask first.
 * Render `dialogs` once on the page.
 */
export function useDeliveryActions(onChanged: () => void) {
  const [working, setWorking] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [otp, setOtp] = useState("");
  const [reason, setReason] = useState<FailureReason | "">("");
  const [note, setNote] = useState("");

  const close = () => { setDialog(null); setOtp(""); setReason(""); setNote(""); };
  const run = async (delivery: PartnerDelivery, work: () => Promise<unknown>, done: string) => {
    setWorking(delivery._id);
    try {
      await work();
      toast.success(done, { duration: 2500 });
      close();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to update the delivery"));
    } finally {
      setWorking(null);
    }
  };

  const next = (delivery: PartnerDelivery) => {
    const action = NEXT_ACTION[delivery.status];
    if (!action) return;
    if (action.next === "Delivered") return setDialog({ kind: "deliver", delivery });
    void run(delivery, () => deliveryApi.advance(delivery._id, action.next as "Accepted" | "Picked Up" | "On The Way"), STEP_DONE[action.next]);
  };
  const decline = (delivery: PartnerDelivery) => setDialog({ kind: "decline", delivery });
  // "Customer unreachable" opens the same form with that reason already chosen.
  const fail = (delivery: PartnerDelivery, preset: FailureReason | "" = "") => { setReason(preset); setDialog({ kind: "fail", delivery }); };

  const busy = dialog !== null && working === dialog.delivery._id;
  const confirm = () => {
    if (!dialog) return;
    const { delivery } = dialog;
    if (dialog.kind === "deliver") void run(delivery, () => deliveryApi.deliver(delivery._id, otp), "Delivery completed");
    if (dialog.kind === "decline") void run(delivery, () => deliveryApi.decline(delivery._id, note.trim()), "Delivery declined");
    if (dialog.kind === "fail" && reason) void run(delivery, () => deliveryApi.fail(delivery._id, reason, note.trim()), "Failed delivery reported");
  };

  const dialogs = (
    <>
      {dialog?.kind === "deliver" && (
        <PortalDialog title="Confirm delivery" confirmLabel="Confirm delivered" busy={busy} disabled={otp.length !== 6} onConfirm={confirm} onClose={close}
          description={<>Ask the customer for the 6-digit code on their order page.{dialog.delivery.order && !dialog.delivery.order.isPaid && <> Collect <strong>{cedis(dialog.delivery.order.total)}</strong> in cash.</>}</>}>
          <label htmlFor="delivery-otp" className="sr-only">Delivery code</label>
          <input id="delivery-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} autoFocus
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="000000"
            className="w-full h-14 px-4 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border border-app-border focus:border-app-green focus:ring-2 focus:ring-app-green/20 outline-none" />
        </PortalDialog>
      )}
      {dialog?.kind === "decline" && (
        <PortalDialog title="Decline this delivery?" tone="danger" confirmLabel="Decline" busy={busy} onConfirm={confirm} onClose={close}
          description={<>Order #{dialog.delivery.order?.number} goes back to GreenFarm to assign to someone else.</>}>
          <label htmlFor="decline-reason" className="block text-sm font-medium text-app-green mb-1.5">Reason <span className="font-normal text-app-text-light">(optional)</span></label>
          <textarea id="decline-reason" rows={3} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} resize-none`} placeholder="e.g. Too far from my area today" />
        </PortalDialog>
      )}
      {dialog?.kind === "fail" && (
        <PortalDialog title="Report failed delivery" tone="danger" confirmLabel="Report failure" busy={busy} disabled={!reason || (reason === "Other" && !note.trim())} onConfirm={confirm} onClose={close}
          description={<>GreenFarm will arrange another attempt for order #{dialog.delivery.order?.number}. Keep the items safe until they tell you what to do.</>}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-app-green mb-2">What went wrong?</legend>
            {FAILURE_REASONS.map((option) => (
              <label key={option} className={`flex items-center gap-3 min-h-11 px-3 rounded-xl border text-sm cursor-pointer ${reason === option ? "border-red-300 bg-red-50 text-red-800" : "border-app-border text-zinc-700"}`}>
                <input type="radio" name="fail-reason" value={option} checked={reason === option} onChange={() => setReason(option)} className="accent-red-600" />
                {option}
              </label>
            ))}
          </fieldset>
          <label htmlFor="fail-note" className="block text-sm font-medium text-app-green mt-4 mb-1.5">Details {reason !== "Other" && <span className="font-normal text-app-text-light">(optional)</span>}</label>
          <textarea id="fail-note" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} resize-none`} placeholder="e.g. Called three times, no answer" />
        </PortalDialog>
      )}
    </>
  );

  return { working, next, decline, fail, dialogs };
}
