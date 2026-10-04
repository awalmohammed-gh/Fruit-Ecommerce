import { BellIcon, ChevronRightIcon, KeyRoundIcon, LifeBuoyIcon, LogOutIcon, MailIcon, MapPinIcon, Package2Icon, UserIcon } from "lucide-react";
import React, { useState } from "react";
import toast from "../components/toast/toast";
import { Link, useSearchParams } from "react-router-dom";
import { footerData } from "../assets/assets";
import UserAvatar from "../components/navbar/UserAvatar";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useAddresses } from "../hooks/useAddresses";
import type { AuthUser } from "../frontApisRoute/auth";

// Orders and addresses already have their own pages, so those entries link out.
const sections = [
  { key: "profile", name: "Profile", icon: UserIcon },
  { key: "orders", name: "Orders", icon: Package2Icon, path: "/my-orders" },
  { key: "addresses", name: "Saved Addresses", icon: MapPinIcon, path: "/my-address" },
  { key: "notifications", name: "Notifications", icon: BellIcon },
  { key: "password", name: "Change Password", icon: KeyRoundIcon },
  { key: "help", name: "Help & Support", icon: LifeBuoyIcon },
];

const inputClass =
  "w-full px-4 py-3 text-sm bg-white rounded-xl border border-app-border focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all duration-300";

const ProfileForm = ({ user }: { user: AuthUser }) => {
  const { updateProfile } = useCustomerAuth();
  const [displayName, setDisplayName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [avatar, setAvatar] = useState(user.avatar);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = displayName.trim() !== user.fullName || phone.trim() !== user.phone || avatar.trim() !== user.avatar;
  return (
    <form onSubmit={async (event: React.SubmitEvent) => {
      event.preventDefault();
      if (!displayName.trim() || saving) return;
      setSaving(true); setError("");
      try { await updateProfile({ fullName: displayName.trim(), phone: phone.trim(), avatar: avatar.trim() }); toast.success("Profile updated"); }
      catch (error) { setError(error instanceof Error ? error.message : "Unable to update profile"); }
      finally { setSaving(false); }
    }} className="space-y-5">
      {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label htmlFor="profile-name" className="text-sm font-semibold text-gray-700">Full name</label>
          <input id="profile-name" disabled={saving} autoComplete="name" required maxLength={100} value={displayName}
            onChange={(event) => setDisplayName(event.target.value)} className={inputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-email" className="text-sm font-semibold text-gray-700">Email address</label>
          <input id="profile-email" type="email" autoComplete="email" value={user.email} readOnly
            aria-describedby="profile-email-hint" className={`${inputClass} bg-gray-50 text-zinc-500`} />
          <p id="profile-email-hint" className="text-xs text-app-text-light">Your sign-in email. Email changes aren’t available yet.</p>
        </div>
        <div className="space-y-2"><label htmlFor="profile-phone" className="text-sm font-semibold text-gray-700">Phone (optional)</label>
          <input id="profile-phone" disabled={saving} type="tel" autoComplete="tel" maxLength={25} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} /></div>
        <div className="space-y-2"><label htmlFor="profile-avatar" className="text-sm font-semibold text-gray-700">Avatar image URL (optional)</label>
          <input id="profile-avatar" disabled={saving} type="url" maxLength={2048} value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://..." className={inputClass} />
          <p className="text-xs text-app-text-light">Use an HTTPS image link, or leave empty to use your initial.</p></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-app-border pt-5">
        <p className="text-xs text-app-text-light">Your details are saved to your account.</p>
        <button type="submit" disabled={saving || !changed || !displayName.trim()}
          className="px-6 py-3 text-sm font-semibold bg-app-green text-white rounded-xl hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
};

const ChangePasswordForm = () => {
  const { changePassword } = useCustomerAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className="space-y-4 max-w-md" onSubmit={async (event: React.SubmitEvent) => {
    event.preventDefault();
    if (saving) return;
    if (form.next !== form.confirm) { setError("Passwords do not match"); return; }
    setSaving(true); setError("");
    try { await changePassword(form.current, form.next); setForm({ current: "", next: "", confirm: "" }); toast.success("Password changed. Other sessions have been signed out."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to change password"); }
    finally { setSaving(false); }
  }}>
    <p className="text-sm text-app-text-light">Choose a password with at least 8 characters. Changing it signs out your other sessions.</p>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</p>}
    {([["current", "Current password"], ["next", "New password"], ["confirm", "Confirm new password"]] as const).map(([key, label]) => <div key={key} className="space-y-2">
      <label htmlFor={`password-${key}`} className="text-sm font-semibold text-gray-700">{label}</label>
      <input id={`password-${key}`} type="password" disabled={saving} required minLength={key === "current" ? undefined : 8} maxLength={72}
        autoComplete={key === "current" ? "current-password" : "new-password"} value={form[key]} onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))} className={inputClass} />
    </div>)}
    <button type="submit" disabled={saving} className="px-6 py-3 bg-app-green text-white text-sm font-semibold rounded-xl hover:bg-green-800 disabled:opacity-50">{saving ? "Updating..." : "Update password"}</button>
  </form>;
};

const MyAccount = () => {
  const { user, logout } = useCustomerAuth();
  const { addresses, loading: addressesLoading, error: addressesError } = useAddresses();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // CustomerRoute handles signed-out visitors; this only covers the moment between sign-out and that redirect.
  if (!user) return null;

  const tab = sections.some((s) => s.key === searchParams.get("tab") && !s.path)
    ? searchParams.get("tab")!
    : "profile";
  const active = sections.find((s) => s.key === tab)!;

  return (
    <div className="bg-app-cream">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-app-green mb-2">Your GreenFarm</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Account</h1>
          <p className="text-sm text-app-text-light mt-2">Your details, deliveries, and everyday essentials in one place.</p>
        </div>

        <div className="bg-green-950 rounded-2xl p-6 sm:p-8 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-white">
          <div className="flex items-center gap-4 min-w-0">
            <UserAvatar name={user.fullName} avatar={user.avatar} className="size-16 text-2xl shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-green-200 mb-1">Welcome back</p>
              <h2 className="text-2xl font-semibold break-words">{user.fullName}</h2>
              <p className="text-sm text-green-100 mt-2 flex items-center gap-2 break-all"><MailIcon className="size-4 shrink-0" />{user.email}</p>
            </div>
          </div>
          <Link to="/products" className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-green-950 text-sm font-semibold hover:bg-green-50">
            Continue shopping <ChevronRightIcon size={16} />
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside aria-label="Account navigation" className="md:w-60 shrink-0">
            <div className="bg-white rounded-2xl p-2 shadow-sm border border-app-border/50 grid grid-cols-2 md:grid-cols-1 gap-1">
              {sections.map(({ key, name, icon: Icon, path }) => {
                const cls = `flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm transition-colors ${
                  tab === key ? "bg-green-50 text-app-green font-semibold" : "text-zinc-500 hover:bg-green-50 hover:text-zinc-900"
                }`;
                return path ? (
                  <Link key={key} to={path} className={cls}>
                    <Icon size={16} />
                    <span className="flex-1">{name}</span>
                    <ChevronRightIcon size={14} />
                  </Link>
                ) : (
                  <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => setSearchParams({ tab: key })} className={cls}>
                    <Icon size={16} />
                    {name}
                  </button>
                );
              })}
              <button type="button" disabled={loggingOut} onClick={async () => {
                setLoggingOut(true);
                try { await logout(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to sign out"); }
                finally { setLoggingOut(false); }
              }} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 rounded-xl hover:bg-red-50 md:mt-3">
                <LogOutIcon size={16} /> {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </aside>

          <section aria-label={active.name} className="flex-1 min-w-0 bg-white rounded-2xl p-5 sm:p-7 shadow-sm border border-app-border/50">
            <h2 className="text-lg font-bold text-gray-800 mb-6">{active.name}</h2>

            {tab === "profile" && (
              <div className="space-y-7">
                <p className="text-sm text-app-text-light -mt-3">Keep your personal details up to date.</p>
                <ProfileForm key={user._id} user={user} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Link to="/my-orders" className="flex items-center gap-3 p-4 rounded-xl border border-app-border hover:bg-green-50">
                    <Package2Icon className="size-5 text-app-green shrink-0" />
                    <div className="flex-1"><p className="text-sm font-semibold text-zinc-900">My orders</p><p className="text-xs text-app-text-light mt-1">Track deliveries and past orders</p></div>
                    <ChevronRightIcon className="size-4 text-zinc-400 shrink-0" />
                  </Link>
                  <Link to="/my-address" className="flex items-center gap-3 p-4 rounded-xl border border-app-border hover:bg-green-50">
                    <MapPinIcon className="size-5 text-app-green shrink-0" />
                    <div className="flex-1"><p className="text-sm font-semibold text-zinc-900">Saved addresses</p><p className="text-xs text-app-text-light mt-1">{addressesLoading ? "Loading addresses..." : addressesError ? "View your addresses" : `${addresses.length} saved ${addresses.length === 1 ? "address" : "addresses"}`}</p></div>
                    <ChevronRightIcon className="size-4 text-zinc-400 shrink-0" />
                  </Link>
                </div>
              </div>
            )}

            {tab === "notifications" && (
              <div className="text-center py-12">
                <div className="size-16 bg-app-cream rounded-full flex-center mx-auto mb-4">
                  <BellIcon className="size-7 text-app-text-light" />
                </div>
                <p className="font-semibold text-gray-800">No notifications yet</p>
                <p className="text-sm text-app-text-light mt-1">Order and delivery updates will show up here.</p>
              </div>
            )}

            {tab === "password" && (
              <ChangePasswordForm />
            )}

            {tab === "help" && (
              <div className="space-y-3">
                <p className="text-sm text-app-text-light mb-4">Need help with an order? Reach us here:</p>
                {footerData.contact.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-gray-700">
                    <Icon className="size-4 text-app-green" />
                    {text}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default MyAccount;
