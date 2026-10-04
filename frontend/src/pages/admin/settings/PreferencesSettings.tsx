import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import Panel from "../../../components/admin/Panel";
import { ErrorState, LoadingState } from "../../../components/admin/States";
import toast from "../../../components/toast/toast";
import { useAdminPreferences } from "../../../context/AdminPreferencesContext";
import type { AdminPreferences } from "../../../frontApisRoute/adminSettings";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

interface Props { onDirty: (section: string, dirty: boolean) => void }
const OPTIONS = {
  appearance: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System default" }],
  sidebar: [{ value: "expanded", label: "Expanded" }, { value: "collapsed", label: "Collapsed" }],
  tableDensity: [{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }],
  pageSize: [10, 20, 50, 100].map((value) => ({ value: String(value), label: `${value} items` })),
  dateFormat: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((value) => ({ value, label: value })),
  timeFormat: [{ value: "12-hour", label: "12-hour" }, { value: "24-hour", label: "24-hour" }],
  currencyDisplay: [{ value: "symbol", label: "Symbol (GH₵)" }, { value: "code", label: "Code (GHS)" }],
};
type SelectKey = keyof typeof OPTIONS;

function PreferencesForm({ onDirty }: Props) {
  const { preferences, save } = useAdminPreferences();
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences);
  useEffect(() => onDirty("preferences", dirty), [dirty, onDirty]);

  const field = (key: SelectKey, label: string, hint?: string) => <div className={ui.field}>
    <label className={ui.label} htmlFor={`preference-${key}`}>{label}</label>
    <select id={`preference-${key}`} className={ui.select} value={draft[key]} disabled={saving} onChange={(event) => {
      const value = key === "pageSize" ? Number(event.target.value) : event.target.value;
      setDraft((previous) => ({ ...previous, [key]: value }) as AdminPreferences);
    }}>{OPTIONS[key].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    {hint && <p className={ui.hint}>{hint}</p>}
  </div>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    try { await save(draft); toast.success("Preferences saved successfully"); }
    catch (failure) { toast.error(failure instanceof Error ? failure.message : "Unable to save preferences"); }
    finally { setSaving(false); }
  };

  return <form onSubmit={submit} className={s.stack}>
    <Panel title="Appearance" description="Choose the theme for your management workspace.">
      {field("appearance", "Theme", "System default follows your device’s appearance, including changes while you work. Save to apply your choice.")}
    </Panel>
    <Panel title="Interface" description="Choose how you work with navigation and management lists.">
      <div className={ui.formGrid}>{field("sidebar", "Sidebar")}{field("tableDensity", "Table density")}{field("pageSize", "Default page size", "Applies to paginated management lists.")}</div>
    </Panel>
    <Panel title="Date, time & currency" description="Display preferences for your account. Store currency stays Ghana cedis.">
      <div className={ui.formGrid}>{field("dateFormat", "Date format")}{field("timeFormat", "Time format")}{field("currencyDisplay", "Currency display", "Changes presentation only, never prices or currency.")}</div>
    </Panel>
    <Panel title="Notifications" description="Management notification delivery is not connected yet.">
      <div className={s.notificationOptions}>{["New orders", "Low stock", "New delivery applications", "Failed deliveries", "Important system alerts"].map((label) => <label key={label}><input type="checkbox" disabled />{label}<span>Unavailable</span></label>)}</div>
      <p className={ui.hint}>These controls will become available when notifications are supported. Existing dashboard counts are unaffected.</p>
    </Panel>
    <div className={`${s.saveBar} ${dirty || saving ? s.saveBarPinned : ""}`}>
      <span className={s.saveState} role="status">{dirty ? "Unsaved preferences" : "Preferences saved to your account"}</span>
      <div className={s.saveButtons}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} disabled={saving || !dirty} onClick={() => setDraft(preferences)}>Discard</button>
        <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={saving || !dirty}>{saving ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <SaveIcon aria-hidden="true" />}{saving ? "Saving…" : "Save preferences"}</button>
      </div>
    </div>
  </form>;
}

export default function PreferencesSettings(props: Props) {
  const { preferences, loading, error, retry } = useAdminPreferences();
  if (loading) return <Panel><LoadingState label="Loading your preferences" /></Panel>;
  if (error) return <Panel><ErrorState message={error} onRetry={retry} /></Panel>;
  return <PreferencesForm key={JSON.stringify(preferences)} {...props} />;
}
