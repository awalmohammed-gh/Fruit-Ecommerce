import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { BikeIcon, BusIcon, CarIcon, LoaderCircleIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ghanaRegions } from "../../frontApisRoute/addresses";
import { deliveryApi, type ApplicationInput, type Availability, type IdType, type PartnerApplication } from "../../frontApisRoute/delivery";
import type { TransportType } from "../../types";
import { AVAILABILITY_LABEL, ID_LABEL, TRANSPORT_LABEL, isMotorised } from "../../utils/delivery";
import styles from "./ApplicationForm.module.css";

export const inputClass = "w-full px-4 py-2.5 text-sm rounded-xl border border-app-border focus:border-app-green focus:ring-2 focus:ring-app-green/20 outline-none bg-white disabled:bg-app-cream disabled:text-app-text-light";
const TRANSPORT_ICON: Record<TransportType, LucideIcon> = { motorbike: BikeIcon, bicycle: BikeIcon, car: CarIcon, van: BusIcon, other: TruckIcon };

interface Props {
  // A rejected application pre-fills the form so the applicant only fixes what's needed.
  previous: PartnerApplication | null;
  // The reference code is shown once; the applicant needs it to check their status and activate.
  onSubmitted: (application: PartnerApplication, reference: string) => void;
}

function initial(previous: PartnerApplication | null): ApplicationInput {
  if (!previous) {
    return { fullName: "", email: "", phone: "", dateOfBirth: "", region: "", city: "", address: "", digitalAddress: "", transportType: "", vehicleType: "",
      vehicleRegistration: "", licenseNumber: "", idType: "", idNumber: "", emergencyContactName: "", emergencyContactPhone: "", availability: "", notes: "" };
  }
  return {
    fullName: previous.fullName, email: previous.email, phone: previous.phone, dateOfBirth: previous.dateOfBirth.slice(0, 10), region: previous.region, city: previous.city, address: previous.address,
    digitalAddress: previous.digitalAddress, transportType: previous.transportType, vehicleType: previous.vehicleType, vehicleRegistration: previous.vehicleRegistration,
    licenseNumber: previous.licenseNumber, idType: previous.idType, idNumber: previous.idNumber, emergencyContactName: previous.emergencyContact.name,
    emergencyContactPhone: previous.emergencyContact.phone, availability: previous.availability, notes: previous.notes,
  };
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className={styles.section}>
      <legend className="flex items-center gap-3 mb-1">
        <span className="size-7 rounded-full bg-app-green text-white text-xs font-semibold flex-center shrink-0">{step}</span>
        <span className="text-base font-semibold text-app-green">{title}</span>
      </legend>
      {hint && <p className="text-xs text-app-text-light mb-4 ml-10">{hint}</p>}
      <div className={`grid sm:grid-cols-2 gap-4 ${hint ? "" : "mt-4"}`}>{children}</div>
    </fieldset>
  );
}

function Field({ label, id, optional, wide, help, children }: { label: string; id: string; optional?: boolean; wide?: boolean; help?: string; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="block text-sm font-medium text-app-green mb-1.5">
        {label}{optional && <span className="font-normal text-app-text-light"> (optional)</span>}
      </label>
      {children}
      {help && <p className="text-xs text-app-text-light mt-1.5">{help}</p>}
    </div>
  );
}

export default function ApplicationForm({ previous, onSubmitted }: Props) {
  const [form, setForm] = useState<ApplicationInput>(() => initial(previous));
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const motorised = isMotorised(form.transportType);
  const latestBirthDate = new Date(Date.UTC(new Date().getUTCFullYear() - 18, new Date().getUTCMonth(), new Date().getUTCDate())).toISOString().slice(0, 10);

  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [event.target.name]: event.target.value });
  const input = (name: keyof ApplicationInput, props: Record<string, unknown> = {}) => (
    <input id={`apply-${name}`} name={name} value={form[name]} onChange={change} className={inputClass} {...props} />
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // A bicycle or "other" doesn't need vehicle papers, so don't send stale values from an earlier choice.
      const payload = motorised ? form : { ...form, vehicleRegistration: "", licenseNumber: "" };
      const result = await deliveryApi.apply(payload);
      onSubmitted(result.application, result.reference);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to submit your application");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${styles.form} bg-white rounded-2xl border border-app-border/60 shadow-sm p-5 sm:p-8 space-y-6`} aria-busy={saving} aria-describedby={error ? "apply-error" : undefined}>
      {error && <p id="apply-error" role="alert" className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">{error}</p>}
      {previous?.applicationStatus === "Rejected" && (
        <p className="rounded-xl bg-app-cream p-3 text-sm text-app-green">We've filled in your previous answers. Update anything that has changed and submit again.</p>
      )}
      <fieldset disabled={saving} className="space-y-6 disabled:opacity-70">
        <Section step={1} title="Personal details">
          <Field label="Full name" id="apply-fullName">{input("fullName", { required: true, maxLength: 100, autoComplete: "name" })}</Field>
          <Field label="Email" id="apply-email" help="You'll sign in to the delivery dashboard with this email.">{input("email", { required: true, type: "email", maxLength: 254, autoComplete: "email" })}</Field>
          <Field label="Phone number" id="apply-phone">{input("phone", { required: true, type: "tel", maxLength: 25, autoComplete: "tel", placeholder: "024 123 4567" })}</Field>
          <Field label="Date of birth" id="apply-dateOfBirth" help="You must be 18 or older.">{input("dateOfBirth", { required: true, type: "date", max: latestBirthDate, min: "1940-01-01" })}</Field>
        </Section>

        <Section step={2} title="Where you live" hint="We use this to offer you deliveries close to home.">
          <Field label="Region" id="apply-region">
            <select id="apply-region" name="region" value={form.region} onChange={change} required className={inputClass}>
              <option value="">Select region</option>
              {ghanaRegions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </Field>
          <Field label="City / area" id="apply-city">{input("city", { required: true, maxLength: 100, autoComplete: "address-level2", placeholder: "e.g. East Legon" })}</Field>
          <Field label="Residential address" id="apply-address" wide>{input("address", { required: true, maxLength: 200, autoComplete: "street-address", placeholder: "House number and street" })}</Field>
          <Field label="GhanaPost GPS / digital address" id="apply-digitalAddress" optional>{input("digitalAddress", { maxLength: 40, placeholder: "e.g. GA-123-4567" })}</Field>
        </Section>

        <Section step={3} title="Transport">
          <div className="sm:col-span-2" role="radiogroup" aria-label="Means of transport">
            <p className="block text-sm font-medium text-app-green mb-2">Means of transport</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(TRANSPORT_LABEL) as TransportType[]).map((option) => {
                const Icon = TRANSPORT_ICON[option];
                const selected = form.transportType === option;
                return (
                  <label key={option} className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm cursor-pointer transition-colors has-focus-visible:ring-2 has-focus-visible:ring-app-green/30 ${selected ? "border-app-green bg-app-green/5 text-app-green font-semibold" : "border-app-border text-zinc-600 hover:border-app-green/40"}`}>
                    <input type="radio" name="transportType" value={option} checked={selected} onChange={change} required className="sr-only" />
                    <Icon className="size-5" aria-hidden="true" />
                    {TRANSPORT_LABEL[option]}
                  </label>
                );
              })}
            </div>
          </div>
          <Field label="Vehicle make and model" id="apply-vehicleType" optional={!motorised} wide={!motorised}>
            {input("vehicleType", { maxLength: 80, required: motorised, placeholder: form.transportType === "bicycle" ? "e.g. Mountain bike" : "e.g. Honda Ace 125" })}
          </Field>
          {motorised && (
            <>
              <Field label="Vehicle registration number" id="apply-vehicleRegistration">{input("vehicleRegistration", { required: true, maxLength: 30, placeholder: "e.g. GR 1234-21" })}</Field>
              <Field label="Driver's licence number" id="apply-licenseNumber">{input("licenseNumber", { required: true, maxLength: 40 })}</Field>
            </>
          )}
        </Section>

        <Section step={4} title="Identification" hint="Used only by GreenFarm management to verify who you are. It's never shown to customers.">
          <Field label="ID type" id="apply-idType">
            <select id="apply-idType" name="idType" value={form.idType} onChange={change} required className={inputClass}>
              <option value="">Select ID type</option>
              {(Object.keys(ID_LABEL) as IdType[]).map((option) => <option key={option} value={option}>{ID_LABEL[option]}</option>)}
            </select>
          </Field>
          <Field label="ID number" id="apply-idNumber">{input("idNumber", { required: true, maxLength: 40, autoComplete: "off", placeholder: form.idType === "ghana-card" ? "GHA-000000000-0" : undefined })}</Field>
        </Section>

        <Section step={5} title="Emergency contact" hint="Someone we can reach if something happens while you're on a delivery.">
          <Field label="Contact name" id="apply-emergencyContactName">{input("emergencyContactName", { required: true, maxLength: 100 })}</Field>
          <Field label="Contact phone" id="apply-emergencyContactPhone">{input("emergencyContactPhone", { required: true, type: "tel", maxLength: 25 })}</Field>
        </Section>

        <Section step={6} title="Availability">
          <div className="sm:col-span-2" role="radiogroup" aria-label="When you can deliver">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((option) => (
                <label key={option} className={`rounded-full border px-4 py-2 text-sm cursor-pointer transition-colors has-focus-visible:ring-2 has-focus-visible:ring-app-green/30 ${form.availability === option ? "border-app-green bg-app-green text-white" : "border-app-border text-zinc-600 hover:border-app-green/40"}`}>
                  <input type="radio" name="availability" value={option} checked={form.availability === option} onChange={change} required className="sr-only" />
                  {AVAILABILITY_LABEL[option]}
                </label>
              ))}
            </div>
          </div>
          <Field label="Anything else we should know?" id="apply-notes" optional wide>
            <textarea id="apply-notes" name="notes" value={form.notes} onChange={change} rows={3} maxLength={500} className={`${inputClass} resize-none`} placeholder="Areas you know well, previous delivery experience…" />
          </Field>
        </Section>
      </fieldset>

      <div className="rounded-2xl bg-app-cream p-4 space-y-4">
        <label className="flex items-start gap-3 text-sm text-zinc-700 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required disabled={saving} className="mt-0.5 size-4 accent-app-green" />
          <span>I confirm these details are correct and understand GreenFarm will review them before I can take deliveries.</span>
        </label>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-xs text-app-text-light flex items-center gap-1.5"><ShieldCheckIcon className="size-4 text-app-green" aria-hidden="true" /> Your ID details are only visible to GreenFarm management.</p>
          <button type="submit" disabled={saving || !confirmed} className="w-full sm:w-auto px-8 py-3 bg-app-green text-white font-semibold rounded-full hover:bg-app-green-light disabled:opacity-50 flex-center gap-2">
            {saving ? <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Submitting…" : "Submit application"}
          </button>
        </div>
      </div>
    </form>
  );
}
