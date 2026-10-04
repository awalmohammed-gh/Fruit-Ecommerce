import { useState, type ChangeEvent, type FormEvent } from "react";
import { LoaderCircleIcon, LockIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import { ghanaRegions } from "../../frontApisRoute/addresses";
import { deliveryApi, type Availability, type PartnerProfileInput } from "../../frontApisRoute/delivery";
import { AVAILABILITY_LABEL, TRANSPORT_LABEL, applicationStatusClass, shortDate } from "../../utils/delivery";
import { inputClass } from "../../components/Delivery/ApplicationForm";
import { usePartner } from "./DeliveryLayout";

export default function DeliveryProfile() {
  const { partner, refreshPartner } = usePartner();
  const [form, setForm] = useState<PartnerProfileInput>({
    phone: partner.phone, region: partner.region, city: partner.city, address: partner.address, digitalAddress: partner.digitalAddress,
    availability: partner.availability, emergencyContactName: partner.emergencyContact.name, emergencyContactPhone: partner.emergencyContact.phone,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [event.target.name]: event.target.value });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      toast.success((await deliveryApi.updateProfile(form)).message);
      refreshPartner();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save your profile");
    } finally {
      setSaving(false);
    }
  };

  // Identity, vehicle and account status are checked by management, so partners can't edit them here.
  const fixed: [string, string][] = [
    ["Full name", partner.fullName],
    ["Email", partner.email],
    ["Transport", TRANSPORT_LABEL[partner.transportType]],
    ["Vehicle", partner.vehicleType || "—"],
    ["Registration", partner.vehicleRegistration || "—"],
    ["Partner since", partner.approvedAt ? shortDate(partner.approvedAt) : "—"],
  ];
  const field = (name: keyof PartnerProfileInput, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <label htmlFor={`profile-${name}`} className="block text-sm font-medium text-app-green mb-1.5">{label}</label>
      <input id={`profile-${name}`} name={name} value={form[name]} onChange={change} className={inputClass} {...props} />
    </div>
  );

  return (
    <div className="space-y-5">

      <section className="bg-white rounded-2xl border border-app-border/60 shadow-sm p-5 sm:p-6" aria-labelledby="account-heading">
        <div className="flex items-center gap-4 mb-5">
          <span className="size-14 rounded-full bg-app-green text-white text-xl font-semibold flex-center" aria-hidden="true">{partner.fullName.charAt(0)}</span>
          <div className="min-w-0">
            <h2 id="account-heading" className="text-lg font-semibold text-zinc-900 truncate">{partner.fullName}</h2>
            <span className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ring-1 ring-inset ${applicationStatusClass[partner.applicationStatus]}`}>
              {partner.applicationStatus === "Approved" ? "Active partner" : partner.applicationStatus}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {fixed.map(([label, value]) => (
            <div key={label} className="min-w-0"><dt className="text-xs text-app-text-light">{label}</dt><dd className="font-medium text-zinc-800 truncate">{value}</dd></div>
          ))}
        </dl>
        <p className="mt-5 text-xs text-app-text-light flex items-center gap-1.5"><LockIcon className="size-3.5" aria-hidden="true" /> To change your name, email or vehicle, contact GreenFarm.</p>
      </section>

      <form onSubmit={save} className="bg-white rounded-2xl border border-app-border/60 shadow-sm p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-semibold text-app-green">Contact and location</h2>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <fieldset disabled={saving} className="grid sm:grid-cols-2 gap-4 disabled:opacity-70">
          {field("phone", "Phone number", { type: "tel", required: true, maxLength: 25, autoComplete: "tel" })}
          <div>
            <label htmlFor="profile-region" className="block text-sm font-medium text-app-green mb-1.5">Region</label>
            <select id="profile-region" name="region" value={form.region} onChange={change} required className={inputClass}>
              {ghanaRegions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </div>
          {field("city", "City / area", { required: true, maxLength: 100 })}
          {field("digitalAddress", "GhanaPost GPS", { maxLength: 40 })}
          <div className="sm:col-span-2">{field("address", "Residential address", { required: true, maxLength: 200 })}</div>
          <div>
            <label htmlFor="profile-availability" className="block text-sm font-medium text-app-green mb-1.5">Availability</label>
            <select id="profile-availability" name="availability" value={form.availability} onChange={change} className={inputClass}>
              {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((option) => <option key={option} value={option}>{AVAILABILITY_LABEL[option]}</option>)}
            </select>
          </div>
          <div className="hidden sm:block" />
          {field("emergencyContactName", "Emergency contact name", { required: true, maxLength: 100 })}
          {field("emergencyContactPhone", "Emergency contact phone", { type: "tel", required: true, maxLength: 25 })}
        </fieldset>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="w-full sm:w-auto h-12 px-8 bg-app-green text-white font-semibold rounded-xl hover:bg-app-green-light disabled:opacity-60 flex-center gap-2">
            {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />} Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
