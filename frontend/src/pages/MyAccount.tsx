import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BellIcon, KeyRoundIcon, LifeBuoyIcon, LogOutIcon, MapPinIcon, Package2Icon, SlidersHorizontalIcon, UserIcon, ContactIcon } from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import type { AuthUser } from '../frontApisRoute/auth';
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import PreferenceSettings from '../components/settings/PreferenceSettings';
import PortalDialog from '../components/Delivery/PortalDialog';
import toast from '../components/toast/toast';
import { footerData } from '../assets/assets';
import s from '../components/settings/settings.module.css';
const sections = [
  { key: 'profile', label: 'Profile', description: 'Your personal details and profile photo.', icon: UserIcon },
  { key: 'account', label: 'Account', description: 'A simple overview of your GreenFarm account.', icon: ContactIcon },
  { key: 'security', label: 'Security', description: 'Keep your account secure with a strong password.', icon: KeyRoundIcon },
  { key: 'preferences', label: 'Preferences', description: 'Make everyday shopping work the way you like.', icon: SlidersHorizontalIcon },
  { key: 'notifications', label: 'Notifications', description: 'Choose the updates you see in your notification bell.', icon: BellIcon },
];
const help = { key: 'help', label: 'Help & support', description: 'Get in touch with the GreenFarm team.', icon: LifeBuoyIcon };
function SettingsContent({ user }: { user: AuthUser }) {
  const { logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const requested = search.get('tab') === 'password' ? 'security' : search.get('tab');
  const current = [...sections, help].find((section) => section.key === requested) ?? sections[0]!;
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ tab?: string; path?: string; logout?: boolean } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [revision, setRevision] = useState(0);
  const onState = useCallback((nextDirty: boolean, nextBusy: boolean) => { setDirty(nextDirty); setBusy(nextBusy); }, []);
  const go = useCallback((destination: { tab?: string; path?: string }) => {
    setDirty(false); setBusy(false); setPending(null); setRevision((value) => value + 1);
    if (destination.path) navigate(destination.path);
    else if (destination.tab) setSearch((previous) => { const next = new URLSearchParams(previous); next.set('tab', destination.tab!); return next; });
  }, [navigate, setSearch]);
  const select = (tab: string) => {
    if (busy || tab === current.key) return;
    if (dirty) setPending({ tab }); else go({ tab });
  };
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirty && !busy || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const anchor = event.target.closest('a');
      if (!anchor || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href); if (url.href === location.href || url.origin !== location.origin) return;
      event.preventDefault(); event.stopPropagation();
      if (busy) toast.info('Please wait for your changes to finish saving.');
      else setPending({ path: `${url.pathname}${url.search}${url.hash}` });
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); };
  }, [dirty, busy]);
  const signOut = async () => {
    if (busy || signingOut) return;
    if (dirty) { setPending({ logout: true }); return; }
    setSigningOut(true);
    try { await logout(); } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Unable to sign out.'); }
    finally { setSigningOut(false); }
  };
  return <div className={s.page}><header className={s.heading}><div className={s.eyebrow}>Your GreenFarm account</div><h1>Settings</h1><p>Manage your account, profile and preferences</p></header>
    <div className={s.layout}><aside><nav className={s.nav} aria-label="Settings sections">
      {sections.map(({ key, label, icon: Icon }) => <button key={key} type="button" disabled={busy || signingOut} aria-current={current.key === key ? 'page' : undefined} onClick={() => select(key)}><Icon size={17} aria-hidden="true" />{label}</button>)}
      <div className={s.navExtra}><Link to="/my-orders"><Package2Icon size={17} aria-hidden="true" />My orders</Link><Link to="/my-address"><MapPinIcon size={17} aria-hidden="true" />Saved addresses</Link><button type="button" disabled={busy || signingOut} onClick={() => select('help')} aria-current={current.key === 'help' ? 'page' : undefined}><LifeBuoyIcon size={17} aria-hidden="true" />Help & support</button><button type="button" disabled={busy || signingOut} onClick={() => { void signOut(); }}><LogOutIcon size={17} aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    </nav><div className={s.mobileNav}><label htmlFor="settings-section">Settings section</label><select className={s.input} id="settings-section" disabled={busy || signingOut} value={current.key} onChange={(event) => select(event.target.value)}>{[...sections, help].map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></div></aside>
      <section className={s.panel} aria-labelledby="settings-title"><header className={s.intro}><h2 id="settings-title">{current.label}</h2><p>{current.description}</p></header><div className={s.body}>
        {current.key === 'profile' && <ProfileSettings key={`profile:${revision}`} user={user} onState={onState} />}
        {current.key === 'security' && <SecuritySettings key={`security:${revision}`} onState={onState} />}
        {current.key === 'preferences' && <PreferenceSettings key={`shopping:${revision}`} user={user} onState={onState} />}
        {current.key === 'notifications' && <PreferenceSettings key={`notifications:${revision}`} user={user} notifications onState={onState} />}
        {current.key === 'account' && <><dl className={s.details}>{[
          ['Full name', user.fullName], ['Email address', user.email], ['Phone number', user.phone || 'Not added'],
          ['Member since', new Date(user.createdAt).toLocaleDateString('en-GH', { timeZone: 'Africa/Accra', day: 'numeric', month: 'long', year: 'numeric' })],
        ].map(([label, value]) => <div key={label} className={s.detail}><dt>{label}</dt><dd>{value}</dd></div>)}<div className={s.detail}><dt>Account status</dt><dd><span className={s.status}>{user.isActive ? 'Active' : 'Inactive'}</span></dd></div></dl><div className={s.actions}><p className={s.hint}>Your sign-in email is fixed for this account.</p><button type="button" className={s.button} onClick={() => select('profile')}>Edit profile</button></div><div className={s.actions}><div className={s.actionButtons}><Link className={s.button} to="/my-orders">My orders</Link><Link className={s.button} to="/my-address">Saved addresses</Link><button type="button" className={s.textButton} disabled={signingOut} onClick={() => { void signOut(); }}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div></div></>}
        {current.key === 'help' && <div className={s.details}>{footerData.contact.map(({ icon: Icon, text }) => <div key={text} className={s.detail}><Icon size={18} aria-hidden="true" /><p>{text}</p></div>)}</div>}
      </div></section>
    </div>
    {pending && <PortalDialog title="Discard unsaved changes?" description="Your unsaved details or selected photo will be discarded. Changes you have already saved will stay on your account." confirmLabel="Discard changes" busy={false} onClose={() => setPending(null)} onConfirm={() => {
      if (pending.logout) { setDirty(false); setPending(null); setSigningOut(true); void logout().catch((failure: unknown) => toast.error(failure instanceof Error ? failure.message : 'Unable to sign out.')).finally(() => setSigningOut(false)); }
      else go(pending);
    }} />}
  </div>;
}
export default function MyAccount() {
  const { user } = useCustomerAuth();
  return user ? <SettingsContent key={user._id} user={user} /> : null;
}
