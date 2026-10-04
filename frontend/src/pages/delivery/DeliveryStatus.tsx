import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { deliveryApi, type PartnerApplication } from "../../frontApisRoute/delivery";
import ApplicationStatusCard from "../../components/Delivery/ApplicationStatusCard";
import { inputClass } from "../../components/Delivery/ApplicationForm";
import { saveApplication, savedApplication } from "../../utils/partnerApplication";

// Public: check an application, and activate it once approved, using the email and reference code from applying.
export default function DeliveryStatus() {
  const [form, setForm] = useState(() => savedApplication() ?? { email: "", reference: "" });
  const [found, setFound] = useState<{ application: PartnerApplication; reference: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecking(true);
    setError("");
    try {
      const reference = form.reference.trim().toUpperCase();
      const { application } = await deliveryApi.status(form.email.trim(), reference);
      saveApplication({ email: application.email, reference });
      setFound({ application, reference });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to check your application");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl text-app-green">Application status</h1>
        <p className="text-sm text-app-text-light mt-2">Enter the email you applied with and the reference code you got when you submitted. Approved applicants activate their account here.</p>
      </div>

      {found ? (
        <>
          <ApplicationStatusCard application={found.application} reference={found.reference} />
          <button type="button" onClick={() => setFound(null)} className="text-sm font-semibold text-app-green hover:underline">Check a different application</button>
        </>
      ) : (
        <form onSubmit={check} className="bg-white rounded-2xl border border-app-border/60 shadow-sm p-6 space-y-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <fieldset disabled={checking} className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium text-app-green">Email
              <input type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={`${inputClass} mt-1.5`} />
            </label>
            <label className="text-sm font-medium text-app-green">Reference code
              <input required maxLength={20} autoComplete="off" placeholder="GF-XXXX-XXXX" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} className={`${inputClass} mt-1.5 font-mono uppercase`} />
            </label>
          </fieldset>
          <button type="submit" disabled={checking} className="w-full sm:w-auto h-12 px-7 bg-app-green text-white text-sm font-semibold rounded-full hover:bg-app-green-light disabled:opacity-60 flex-center gap-2">
            {checking ? <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" /> : <SearchIcon className="size-4" aria-hidden="true" />} Check status
          </button>
          <p className="text-xs text-app-text-light">Lost your reference code? Contact GreenFarm. Once you're approved, management can give you a new one.</p>
        </form>
      )}

      <p className="text-sm text-app-text-light">
        Haven't applied yet? <Link to="/delivery-partner/apply" className="font-semibold text-app-green hover:underline">Become a delivery partner</Link>
        <span className="mx-2">·</span>
        Already activated? <Link to="/delivery-partner/login" className="font-semibold text-app-green hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
