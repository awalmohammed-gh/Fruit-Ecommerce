import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { CameraIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import type { AuthUser } from '../../frontApisRoute/auth';
import UserAvatar from '../navbar/UserAvatar';
import { photoError, profileErrors } from '../../utils/customerSettings';
import { Feedback, SaveActions } from './SettingsUi';
import { useFormState, type FormState } from '../../hooks/useSettingsForm';
import s from './settings.module.css';

function PhotoEditor({ user, onState }: { user: AuthUser; onState: FormState }) {
  const { uploadAvatar, removeAvatar } = useCustomerAuth();
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useFormState(!!selected, busy, onState);
  useEffect(() => () => { if (selected) URL.revokeObjectURL(selected.url); }, [selected]);
  const save = async (remove = false) => {
    if (busy || !remove && (!selected || !ready)) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      if (remove) await removeAvatar(); else await uploadAvatar(selected!.file);
      setSelected(null); setReady(false);
      setSuccess(remove ? 'Profile photo removed.' : 'Your profile photo has been updated.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to update your photo.'); }
    finally { setBusy(false); }
  };
  return <div><Feedback error={error} success={success} /><div className={s.photo}>
    {selected ? <img className={s.photoImage} src={selected.url} alt="Selected profile photo preview" onLoad={() => setReady(true)} onError={() => { setReady(false); setError('This image cannot be opened. Choose another photo.'); }} /> : <UserAvatar name={user.fullName} avatar={user.avatar} className="size-[88px] max-sm:size-[68px] text-3xl" />}
    <div className={s.photoCopy}><strong>{user.fullName}</strong><p className={s.muted}>{user.email}</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" tabIndex={-1} aria-hidden="true" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        const invalid = photoError(file); setError(invalid); setSuccess(''); if (invalid) return;
        setReady(false); setSelected({ file, url: URL.createObjectURL(file) });
      }} />
      <div className={s.photoActions}>
        {selected ? <><button type="button" className={`${s.button} ${s.primary}`} disabled={busy || !ready} onClick={() => { void save(); }}>{busy ? 'Uploading…' : 'Upload photo'}</button><button type="button" className={s.textButton} disabled={busy} onClick={() => { setSelected(null); setReady(false); setError(''); }}>Cancel selection</button></> : <><button type="button" className={s.button} disabled={busy} onClick={() => input.current?.click()}><CameraIcon size={15} aria-hidden="true" />Change photo</button>{user.avatar && <button type="button" className={s.textButton} disabled={busy} onClick={() => { void save(true); }}>{busy ? 'Removing…' : 'Remove photo'}</button>}</>}
      </div><p className={s.hint}>{selected ? 'Preview your photo, then upload to save it.' : 'JPG, PNG or WebP. Max 5 MB.'}</p>
      {busy && <p className={s.hint} role="status">{selected ? 'Uploading your photo…' : 'Removing your photo…'}</p>}
    </div>
  </div></div>;
}

export default function ProfileSettings({ user, onState }: { user: AuthUser; onState: FormState }) {
  const { updateProfile } = useCustomerAuth();
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState({ dirty: false, busy: false });
  const photoState = useCallback((dirty: boolean, busy: boolean) => setPhoto({ dirty, busy }), []);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dirty = name.trim() !== user.fullName || phone.trim() !== user.phone;
  const busy = saving || photo.busy;
  useFormState(dirty || photo.dirty, busy, onState);
  const errors = profileErrors(name, phone);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault(); setChecked(true); if (busy || !dirty || Object.values(errors).some(Boolean)) return;
    setSaving(true); setError(''); setSuccess('');
    try { await updateProfile({ fullName: name.trim(), phone: phone.trim() }); setName(name.trim()); setPhone(phone.trim()); setSuccess('Your profile details have been saved.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save your profile.'); }
    finally { setSaving(false); }
  };
  return <><PhotoEditor user={user} onState={photoState} /><form noValidate onSubmit={submit}><Feedback error={error} success={success} /><div className={s.fields}>
    <div className={s.field}><label htmlFor="profile-name">Full name</label><input className={s.input} id="profile-name" autoComplete="name" maxLength={100} disabled={busy} value={name} onChange={(event) => { setName(event.target.value); setSuccess(''); }} aria-invalid={checked && !!errors.fullName} aria-describedby={checked && errors.fullName ? 'name-error' : undefined} />{checked && errors.fullName && <p id="name-error" className={s.fieldError}>{errors.fullName}</p>}</div>
    <div className={s.field}><label htmlFor="profile-phone">Phone number <span className={s.hint}>(optional)</span></label><input className={s.input} id="profile-phone" type="tel" autoComplete="tel" maxLength={25} disabled={busy} value={phone} onChange={(event) => { setPhone(event.target.value); setSuccess(''); }} aria-invalid={checked && !!errors.phone} aria-describedby={checked && errors.phone ? 'phone-error' : undefined} />{checked && errors.phone && <p id="phone-error" className={s.fieldError}>{errors.phone}</p>}</div>
    <div className={s.field}><label htmlFor="profile-email">Email address</label><input className={s.input} id="profile-email" type="email" value={user.email} readOnly aria-describedby="email-hint" /><p id="email-hint" className={s.hint}>Your sign-in email. Email changes are currently unavailable.</p></div>
    <div className={s.field}><label>Delivery addresses</label><Link className={s.button} to="/my-address">Manage saved addresses</Link><p className={s.hint}>Your delivery addresses are managed separately.</p></div>
  </div><SaveActions dirty={dirty} busy={busy} onDiscard={() => { setName(user.fullName); setPhone(user.phone); setChecked(false); setError(''); setSuccess(''); }} /></form></>;
}
