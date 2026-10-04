import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, LockKeyholeIcon, SaveIcon } from "lucide-react";
import Panel from "../../../components/admin/Panel";
import Badge from "../../../components/admin/Badge";
import { Notice } from "../../../components/admin/States";
import toast from "../../../components/toast/toast";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { adminSettingsApi } from "../../../frontApisRoute/adminSettings";
import { date } from "../lib/format";
import ImageField from "./ImageField";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

function SecuritySettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (next !== confirm) return setError("New passwords do not match");
    setSaving(true);
    setError("");
    try {
      const result = await adminSettingsApi.password(current, next, confirm);
      setCurrent(""); setNext(""); setConfirm("");
      toast.success(result.message);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Unable to change password";
      setError(message); toast.error(message);
    } finally { setSaving(false); }
  };

  return <Panel title="Security" description="Change your password. Other admin sessions will be signed out.">
    <form onSubmit={submit} className={s.fields}>
      <fieldset disabled={saving} className={s.personalFields}>
        {[{ id: "current", label: "Current password", value: current, change: setCurrent, autoComplete: "current-password" },
          { id: "new", label: "New password", value: next, change: setNext, autoComplete: "new-password" },
          { id: "confirm", label: "Confirm new password", value: confirm, change: setConfirm, autoComplete: "new-password" }].map((field) => <div key={field.id} className={ui.field}>
          <label htmlFor={`admin-password-${field.id}`} className={ui.label}>{field.label}</label>
          <input id={`admin-password-${field.id}`} type="password" required minLength={field.id === "current" ? undefined : 8} autoComplete={field.autoComplete} value={field.value} onChange={(event) => field.change(event.target.value)} className={ui.input} />
        </div>)}
      </fieldset>
      <p className={ui.hint}>Use at least 8 characters. Your current session stays signed in.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={s.personalActions}><button type="submit" className={`${ui.button} ${ui.primary}`} disabled={saving || !current || !next || !confirm}>
        {saving ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <LockKeyholeIcon aria-hidden="true" />} {saving ? "Changing password…" : "Change password"}
      </button></div>
    </form>
  </Panel>;
}

export default function AccountSettings({ onDirty }: { onDirty: (section: string, dirty: boolean) => void }) {
  const { admin, updateProfile } = useAdminAuth();
  const [draft, setDraft] = useState({ fullName: admin?.fullName ?? "", phone: admin?.phone ?? "", avatar: admin?.avatar ?? "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const dirty = draft.fullName !== (admin?.fullName ?? "") || draft.phone !== (admin?.phone ?? "") || draft.avatar !== (admin?.avatar ?? "");

  useEffect(() => onDirty("account", dirty), [dirty, onDirty]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || uploading) return;
    setSaving(true); setError("");
    try {
      await updateProfile(draft);
      toast.success("Account updated successfully");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Unable to update account";
      setError(message); toast.error(message);
    } finally { setSaving(false); }
  };

  return <div className={s.stack}>
    <Panel title="Profile information" description="These details belong to your management account only.">
      <form onSubmit={submit} className={s.fields}>
        <fieldset disabled={saving} className={s.personalFields}>
          <ImageField label="Profile photo" uploadedHint="Save your account to use this profile photo." value={draft.avatar} onChange={(avatar) => setDraft((previous) => ({ ...previous, avatar }))} onBusy={setUploading} recommended={{ width: 400, height: 400 }} optional fit="cover" />
          <div className={ui.formGrid}>
            <div className={ui.field}><label htmlFor="admin-full-name" className={ui.label}>Full name</label><input id="admin-full-name" required maxLength={100} autoComplete="name" className={ui.input} value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} /></div>
            <div className={ui.field}><label htmlFor="admin-phone" className={ui.label}>Phone number <span className={ui.optional}>(optional)</span></label><input id="admin-phone" type="tel" maxLength={25} autoComplete="tel" className={ui.input} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div>
            <div className={`${ui.field} ${ui.span2}`}><label htmlFor="admin-email" className={ui.label}>Email</label><input id="admin-email" className={ui.input} value={admin?.email ?? ""} readOnly /><p className={ui.hint}>Your sign-in email is managed by your technical administrator.</p></div>
          </div>
        </fieldset>
        <div className={s.profileMetadata}>
          <span>Role <Badge tone="neutral">Administrator</Badge></span>
          <span>Status <Badge tone={admin?.isActive ? "success" : "neutral"}>{admin?.isActive ? "Active" : "Inactive"}</Badge></span>
          {admin?.lastLoginAt && <span>Last login <strong>{date(admin.lastLoginAt, true)}</strong></span>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className={s.personalActions}><button type="submit" className={`${ui.button} ${ui.primary}`} disabled={saving || uploading || !dirty}>
          {saving ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <SaveIcon aria-hidden="true" />} {saving ? "Saving…" : "Save account"}
        </button></div>
      </form>
    </Panel>
    <SecuritySettings />
  </div>;
}
