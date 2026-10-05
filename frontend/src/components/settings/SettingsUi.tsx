import type { ReactNode } from 'react';
import s from './settings.module.css';
export function Feedback({ error, success }: { error: string; success: string }) {
  return <>{error && <p className={s.error} role="alert">{error}</p>}{success && <p className={s.success} role="status">{success}</p>}</>;
}
export function SaveActions({ dirty, busy, label = 'Save changes', onDiscard, children }: { dirty: boolean; busy: boolean; label?: string; onDiscard: () => void; children?: ReactNode }) {
  return <div className={s.actions}><p className={s.hint}>{children || (dirty ? 'You have unsaved changes.' : 'Your changes are saved to your account.')}</p><div className={s.actionButtons}>
    {dirty && <button type="button" className={s.button} disabled={busy} onClick={onDiscard}>Discard</button>}
    <button type="submit" className={`${s.button} ${s.primary}`} disabled={!dirty || busy}>{busy ? 'Saving…' : label}</button>
  </div></div>;
}
export function SettingsSkeleton() {
  return <div className={s.page} role="status" aria-label="Loading your settings"><div className={s.heading}><h1>Settings</h1><p>Manage your account, profile and preferences</p></div><div className={s.layout}><div className={s.skeleton} /><div className={`${s.panel} ${s.body}`}><div className={s.skeleton} style={{ width: 88, height: 88, borderRadius: '50%', marginBottom: 28 }} /><div className={s.fields}>{[0, 1, 2, 3].map((key) => <div key={key} className={s.skeleton} />)}</div></div></div></div>;
}
