import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRightIcon, BanIcon, CheckCircle2Icon, ClockIcon, CopyIcon, KeyRoundIcon, LoaderCircleIcon, RotateCcwIcon, XCircleIcon, type LucideIcon } from "lucide-react";
import toast from "../toast/toast";
import type { ApplicationStatus, PartnerApplication } from "../../frontApisRoute/delivery";
import { usePartnerAuth } from "../../context/PartnerAuthContext";
import { TRANSPORT_LABEL, applicationStatusClass, shortDate } from "../../utils/delivery";
import { inputClass } from "./ApplicationForm";

const COPY: Record<ApplicationStatus, { icon: LucideIcon; title: string; text: string; iconClass: string }> = {
  Pending: {
    icon: ClockIcon, title: "Application pending", iconClass: "bg-amber-50 text-amber-700",
    text: "Your delivery partner application has been received and is currently under review. Check back here with your email and reference code.",
  },
  Approved: {
    icon: CheckCircle2Icon, title: "Application approved", iconClass: "bg-green-50 text-green-700",
    text: "Welcome to the GreenFarm delivery team. Sign in to your delivery partner dashboard to see the deliveries assigned to you.",
  },
  Rejected: {
    icon: XCircleIcon, title: "Application not approved", iconClass: "bg-zinc-100 text-zinc-600",
    text: "We weren't able to approve your application this time. You can update your details and apply again.",
  },
  Suspended: {
    icon: BanIcon, title: "Account suspended", iconClass: "bg-red-50 text-red-700",
    text: "Your delivery partner account is suspended, so the delivery dashboard isn't available. Contact GreenFarm if you think this is a mistake.",
  },
};

// Approved applicants choose their delivery partner password here, then go straight to their dashboard.
function ActivationForm({ email, reference }: { email: string; reference: string }) {
  const navigate = useNavigate();
  const { activate: activatePartner } = usePartnerAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) return setError("The passwords don't match");
    setSaving(true);
    setError("");
    try {
      await activatePartner(email, reference, password);
      // No toast: on phones it would sit over the dashboard header for its first seconds.
      navigate("/delivery-partner/dashboard", { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to activate your account");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={activate} className="mt-6 rounded-2xl bg-app-cream p-4 sm:p-5 space-y-4">
      <div>
        <p className="font-semibold text-app-green flex items-center gap-2"><KeyRoundIcon className="size-4" aria-hidden="true" /> Activate your account</p>
        <p className="text-xs text-app-text-light mt-1">Choose a password for the delivery partner dashboard. You'll sign in with <strong>{email}</strong>.</p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={saving} className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm font-medium text-app-green">Password
          <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} mt-1.5`} />
        </label>
        <label className="text-sm font-medium text-app-green">Confirm password
          <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={`${inputClass} mt-1.5`} />
        </label>
      </fieldset>
      <p className="text-xs text-app-text-light">At least 8 characters.</p>
      <button type="submit" disabled={saving} className="w-full sm:w-auto h-12 px-7 bg-app-green text-white text-sm font-semibold rounded-full hover:bg-app-green-light disabled:opacity-60 flex-center gap-2">
        {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />} Activate and open dashboard
      </button>
    </form>
  );
}

interface Props {
  application: PartnerApplication;
  // Needed to activate an approved application.
  reference: string;
  // Right after submitting: shows "Application Submitted" and the reference code to keep.
  justSubmitted?: boolean;
  onApplyAgain?: () => void;
}

export default function ApplicationStatusCard({ application, reference, justSubmitted, onApplyAgain }: Props) {
  const status = application.applicationStatus;
  const copy = COPY[status];
  const Icon = copy.icon;
  const reason = status === "Rejected" ? application.rejectionReason : status === "Suspended" ? application.suspensionReason : "";
  const awaitingActivation = status === "Approved" && !application.accountActivated;

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      toast.success("Reference code copied");
    } catch {
      toast.error("Couldn't copy. Write the code down instead.");
    }
  };

  return (
    <section aria-live="polite" className="bg-white rounded-2xl border border-app-border/60 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start gap-5">
        <span className={`size-14 rounded-2xl flex-center shrink-0 ${copy.iconClass}`}><Icon className="size-7" aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-app-green">{justSubmitted ? "Application Submitted" : copy.title}</h2>
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ring-inset ${applicationStatusClass[status]}`}>{status}</span>
          </div>
          <p className="text-sm text-zinc-600 leading-relaxed max-w-xl">
            {justSubmitted ? "Your delivery partner application has been received and is currently under review. GreenFarm management will check your details and approve or decline the application."
              : awaitingActivation ? "Welcome to the GreenFarm delivery team. Set a password below to activate your account and open your delivery dashboard."
              : copy.text}
          </p>

          {justSubmitted && (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-app-green/30 bg-app-cream/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-light">Your reference code</p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <p className="font-mono text-2xl font-bold tracking-wider text-app-green">{reference}</p>
                <button type="button" onClick={copyReference} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-app-border text-xs font-semibold text-app-green hover:bg-app-cream">
                  <CopyIcon className="size-3.5" aria-hidden="true" /> Copy
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-2">Keep this code. With your email, it lets you check your application and activate your account once you're approved. We've also saved it on this device.</p>
            </div>
          )}
          {reason && (
            <p className="mt-4 rounded-xl bg-app-cream px-4 py-3 text-sm text-zinc-700"><span className="font-semibold text-app-green">Reason from GreenFarm: </span>{reason}</p>
          )}

          <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><dt className="text-xs text-app-text-light">Applicant</dt><dd className="font-medium text-zinc-800 truncate">{application.fullName}</dd></div>
            <div><dt className="text-xs text-app-text-light">Submitted</dt><dd className="font-medium text-zinc-800">{shortDate(application.updatedAt)}</dd></div>
            <div><dt className="text-xs text-app-text-light">Transport</dt><dd className="font-medium text-zinc-800">{TRANSPORT_LABEL[application.transportType]}</dd></div>
          </dl>

          {awaitingActivation && <ActivationForm email={application.email} reference={reference} />}
          {status === "Approved" && application.accountActivated && (
            <Link to="/delivery-partner/login" className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-app-green text-white text-sm font-semibold rounded-full hover:bg-app-green-light">
              Sign in to my dashboard <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          )}
          {status === "Rejected" && onApplyAgain && (
            <button type="button" onClick={onApplyAgain} className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-app-green text-white text-sm font-semibold rounded-full hover:bg-app-green-light">
              <RotateCcwIcon className="size-4" aria-hidden="true" /> Apply again
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
