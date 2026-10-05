import { useState, type SubmitEvent } from 'react';
import { ShieldCheckIcon } from 'lucide-react';
import type { AuthUser, CustomerPreferences } from '../../frontApisRoute/auth';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { Feedback, SaveActions } from './SettingsUi';
import { useFormState, type FormState } from '../../hooks/useSettingsForm';
import s from './settings.module.css';
const choices = [
  { key: 'order', label: 'Order updates', description: 'Order progress, deliveries and payment confirmations.' },
  { key: 'account', label: 'Account updates', description: 'General news and updates about your account.' },
  { key: 'promotion', label: 'Promotions', description: 'Offers, seasonal picks and special promotions.' },
  { key: 'system', label: 'System announcements', description: 'Store hours, maintenance and service announcements.' },
] as const;
export default function PreferenceSettings({ user, notifications = false, onState }: { user: AuthUser; notifications?: boolean; onState: FormState }) {
  const { updatePreferences } = useCustomerAuth();
  const saved = user.preferences;
  const [draft, setDraft] = useState<CustomerPreferences>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dirty = notifications ? choices.some(({ key }) => draft.notifications[key] !== saved.notifications[key]) : draft.productSort !== saved.productSort;
  useFormState(dirty, busy, onState);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault(); if (busy || !dirty) return;
    setBusy(true); setError(''); setSuccess('');
    try { await updatePreferences(notifications ? { notifications: draft.notifications } : { productSort: draft.productSort }); setSuccess(notifications ? 'Notification preferences saved. Your bell now reflects these choices.' : 'Your shopping preference has been saved.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save your preferences.'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit}><Feedback error={error} success={success} />{notifications ? <>
    {choices.map(({ key, label, description }) => <div key={key} className={s.choice}><div><label htmlFor={`notification-${key}`}><strong>{label}</strong></label><p id={`notification-${key}-hint`} className={s.muted}>{description}</p></div><span className={s.switch}><input id={`notification-${key}`} type="checkbox" checked={draft.notifications[key]} disabled={busy} aria-describedby={`notification-${key}-hint`} onChange={(event) => { const checked = event.target.checked; setDraft((previous) => ({ ...previous, notifications: { ...previous.notifications, [key]: checked } })); setSuccess(''); }} /><span aria-hidden="true" /></span></div>)}
    <p className={s.note}><ShieldCheckIcon size={17} aria-hidden="true" /><span>These choices apply to your in-app notification bell. Security notices always remain enabled. Turning a category back on restores notices still within the 90-day history.</span></p>
  </> : <div className={`${s.field} ${s.security}`}><label htmlFor="product-sort">Default product sorting</label><select className={s.input} id="product-sort" disabled={busy} value={draft.productSort} aria-describedby="sort-hint" onChange={(event) => { setDraft((previous) => ({ ...previous, productSort: event.target.value as CustomerPreferences['productSort'] })); setSuccess(''); }}><option value="newest">Newest arrivals</option><option value="rating">Highest rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name: A to Z</option></select><p id="sort-hint" className={s.hint}>Applied when you open the market or a category. You can still choose another order while shopping. GreenFarm uses English and Ghana cedis throughout the store.</p></div>}
    <SaveActions dirty={dirty} busy={busy} label="Save preferences" onDiscard={() => { setDraft(saved); setError(''); setSuccess(''); }} />
  </form>;
}
