import { CheckIcon, MapPinIcon, XIcon } from "lucide-react";
import { useEffect, useRef, type ChangeEvent, type SubmitEvent } from "react";
import { ghanaRegions, type AddressInput } from "../../frontApisRoute/addresses";

interface Props {
  resetForm: () => void;
  handleSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  formData: AddressInput;
  editingId: string | null;
  handleChanges: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  saving: boolean;
  error: string;
}
const inputClass = "w-full px-4 py-2.5 text-sm rounded-xl border border-app-border focus:border-app-green focus:ring-2 focus:ring-app-green/20 outline-none bg-white";
const fields = [
  { key: "label", label: "Label", required: true, max: 60, placeholder: "Home, Office, Family House...", autoComplete: "off" },
  { key: "fullName", label: "Receiver full name", required: true, max: 100, autoComplete: "name" },
  { key: "phone", label: "Phone", required: true, max: 25, autoComplete: "tel", type: "tel", placeholder: "024 123 4567" },
  { key: "addressLine1", label: "Address line 1", required: true, max: 200, autoComplete: "address-line1", placeholder: "House number and street" },
  { key: "addressLine2", label: "Address line 2 (optional)", max: 200, autoComplete: "address-line2", placeholder: "Apartment, floor, building" },
  { key: "city", label: "City", required: true, max: 100, autoComplete: "address-level2", placeholder: "Accra" },
  { key: "digitalAddress", label: "GhanaPost GPS / Digital address (optional)", max: 40, autoComplete: "postal-code", placeholder: "e.g. GA-123-4567" },
  { key: "landmark", label: "Landmark (optional)", max: 200, autoComplete: "off", placeholder: "Nearby landmark or directions" },
  { key: "country", label: "Country", required: true, max: 100, autoComplete: "country-name" },
] as const;

export default function AddressForm({ resetForm, handleSubmit, formData, editingId, handleChanges, saving, error }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby="address-form-title" onCancel={(event) => { if (saving) event.preventDefault(); else resetForm(); }}
    onClick={(event) => { if (!saving && event.target === event.currentTarget) resetForm(); }}
    className="fixed inset-0 m-auto p-4 bg-transparent w-full max-w-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm">
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div><h2 id="address-form-title" className="text-xl font-bold text-gray-800">{editingId ? "Edit Address" : "Add New Address"}</h2>
          <p className="text-xs text-app-text-light mt-1">Where should we deliver your groceries?</p></div>
        <button type="button" onClick={resetForm} disabled={saving} aria-label="Close form" className="p-2 rounded-full hover:bg-app-cream"><XIcon className="size-5" /></button>
      </div>
      {error && <p role="alert" className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</p>}
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
        {fields.map((field) => <div key={field.key}>
          <label htmlFor={`address-${field.key}`} className="block text-sm font-semibold text-gray-700 mb-1.5">{field.label}{"required" in field && field.required && <span className="text-red-500"> *</span>}</label>
          <input id={`address-${field.key}`} name={field.key} value={formData[field.key]} onChange={handleChanges}
            type={"type" in field ? field.type : "text"} required={"required" in field && field.required} maxLength={field.max}
            autoComplete={field.autoComplete} placeholder={"placeholder" in field ? field.placeholder : undefined}
            list={field.key === "label" ? "address-labels" : undefined} className={inputClass} />
          {field.key === "label" && <datalist id="address-labels">{["Home", "Work", "Office", "Family House", "Other"].map((label) => <option key={label} value={label} />)}</datalist>}
          {field.key === "city" && <div className="mt-4"><label htmlFor="address-region" className="block text-sm font-semibold text-gray-700 mb-1.5">Region <span className="text-red-500">*</span></label>
            <select id="address-region" name="region" value={formData.region} onChange={handleChanges} autoComplete="address-level1" required className={inputClass}>
              <option value="">Select a region</option>{ghanaRegions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select></div>}
        </div>)}
        <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" name="isDefault" checked={formData.isDefault} onChange={handleChanges} className="size-4 accent-green-800" />Make this my default address
        </label>
      </fieldset>
      <div className="flex gap-3 mt-6">
        <button type="button" onClick={resetForm} disabled={saving} className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-3 bg-app-green text-white font-semibold rounded-xl hover:bg-green-800 flex-center gap-2 disabled:opacity-50">
          {editingId ? <CheckIcon className="size-4" /> : <MapPinIcon className="size-4" />}{saving ? "Saving..." : editingId ? "Update Address" : "Save Address"}
        </button>
      </div>
    </form>
  </dialog>;
}
