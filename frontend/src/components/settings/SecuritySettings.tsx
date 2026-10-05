import { useState, type SubmitEvent } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { passwordErrors } from '../../utils/customerSettings';
import { Feedback } from './SettingsUi';
import { useFormState, type FormState } from '../../hooks/useSettingsForm';
import s from './settings.module.css';
const empty = { current: '', next: '', confirm: '' };
export default function SecuritySettings({ onState }: { onState: FormState }) {
  const { changePassword } = useCustomerAuth();
  const [draft, setDraft] = useState(empty);
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useFormState(Object.values(draft).some(Boolean), busy, onState);
  const errors = passwordErrors(draft.current, draft.next, draft.confirm);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault(); setChecked(true); if (busy || Object.values(errors).some(Boolean)) return;
    setBusy(true); setError(''); setSuccess('');
    try { await changePassword(draft.current, draft.next); setSuccess('Password updated. Your other sessions have been signed out.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to change your password.'); }
    finally { setDraft(empty); setVisible({ current: false, next: false, confirm: false }); setChecked(false); setBusy(false); }
  };
  return <form noValidate onSubmit={submit}><Feedback error={error} success={success} /><div className={s.security}>
    {([['current', 'Current password'], ['next', 'New password'], ['confirm', 'Confirm new password']] as const).map(([key, label]) => <div key={key} className={s.field}>
      <label htmlFor={`password-${key}`}>{label}</label><div className={s.password}><input id={`password-${key}`} className={s.input} type={visible[key] ? 'text' : 'password'} autoComplete={key === 'current' ? 'current-password' : 'new-password'} value={draft[key]} maxLength={72} disabled={busy} onChange={(event) => { setDraft((previous) => ({ ...previous, [key]: event.target.value })); setSuccess(''); }} aria-invalid={checked && !!errors[key]} aria-describedby={`password-${key}-hint`} />
        <button type="button" disabled={busy} aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible[key]} onClick={() => setVisible((previous) => ({ ...previous, [key]: !previous[key] }))}>{visible[key] ? <EyeOffIcon size={17} aria-hidden="true" /> : <EyeIcon size={17} aria-hidden="true" />}</button>
      </div><p id={`password-${key}-hint`} className={checked && errors[key] ? s.fieldError : s.hint}>{checked && errors[key] ? errors[key] : key === 'next' ? 'At least 8 characters, up to 72 bytes. Use a password you do not use elsewhere.' : key === 'confirm' ? 'Enter your new password again.' : 'Verify your current password to make this change.'}</p>
    </div>)}
  </div><div className={s.actions}><p className={s.hint}>Changing your password signs out other devices.</p><button type="submit" className={`${s.button} ${s.primary}`} disabled={busy || !Object.values(draft).every(Boolean)}>{busy ? 'Updating…' : 'Update password'}</button></div></form>;
}
