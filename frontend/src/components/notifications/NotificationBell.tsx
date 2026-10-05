import { useCallback, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon, CheckCheckIcon, CreditCardIcon, MegaphoneIcon, PackageIcon, XIcon } from 'lucide-react';
import type { Account } from '../../frontApisRoute/session';
import type { AppNotification } from '../../frontApisRoute/notifications';
import { useNotifications } from '../../hooks/useNotifications';
import { useClickOutside } from '../../hooks/useClickOutside';
import s from './notifications.module.css';

export default function NotificationBell({ account, ownerId }: { account: Account; ownerId: string }) {
  const notifications = useNotifications(account, ownerId);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(root, close, open);
  const activate = async (item: AppNotification) => {
    try {
      const completed = await notifications.read(item._id);
      if (completed && item.link) { setOpen(false); navigate(item.link); }
    } catch { /* The panel displays the server error and keeps the notification available. */ }
  };
  return <div ref={root} className={s.root} onKeyDown={(event) => {
    if (event.key === 'Escape') { setOpen(false); button.current?.focus(); }
  }}>
    <button ref={button} type="button" className={s.bell} aria-label={`Notifications, ${notifications.unreadCount} unread`} aria-expanded={open} aria-controls={panelId}
      onClick={() => { setOpen((value) => !value); if (!open) notifications.refresh(); }}>
      <BellIcon aria-hidden="true" size={20} />
      {notifications.unreadCount > 0 && <span className={s.badge} aria-hidden="true">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>}
    </button>
    <span className="sr-only" role="status" aria-live="polite">{notifications.unreadCount} unread notifications</span>
    {open && <section id={panelId} className={s.panel} aria-label="Notifications">
      <header className={s.header}><div><h2>Notifications</h2><p>{notifications.unreadCount} unread</p></div>
        <button type="button" className={s.iconButton} aria-label="Close notifications" onClick={() => { setOpen(false); button.current?.focus(); }}><XIcon size={18} aria-hidden="true" /></button>
      </header>
      {notifications.error && <p className={s.error} role="alert">{notifications.error} <button type="button" onClick={notifications.refresh}>Retry</button></p>}
      <div className={s.toolbar}>
        <span>{notifications.history ? 'Earlier notifications' : 'Latest updates'}</span>
        <button type="button" disabled={notifications.saving || !notifications.notifications.some((item) => !item.isRead)} onClick={() => { void notifications.readVisible().catch(() => {}); }}><CheckCheckIcon size={14} aria-hidden="true" />Mark visible as read</button>
      </div>
      <div className={s.list}>
        {notifications.loading ? <p role="status" className={s.empty}>Loading notifications…</p> : notifications.notifications.length ? <ul>
          {notifications.notifications.map((item) => {
            const Icon = item.type === 'order' ? PackageIcon : item.type === 'payment' ? CreditCardIcon : item.type === 'promotion' ? MegaphoneIcon : BellIcon;
            return <li key={item._id} className={`${s.item} ${item.isRead ? '' : s.unread}`}>
              <button type="button" className={s.content} disabled={notifications.saving} onClick={() => { void activate(item); }}>
                <span className={s.typeIcon}><Icon size={17} aria-hidden="true" /></span>
                <span className={s.copy}><strong>{item.title}{!item.isRead && <span className={s.dot} aria-label="Unread" />}</strong><span>{item.message}</span>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-GH', { timeZone: 'Africa/Accra', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                </span>
              </button>
              <button type="button" className={s.dismiss} disabled={notifications.saving} aria-label={`Dismiss ${item.title}`} onClick={() => { void notifications.dismiss(item._id).catch(() => {}); }}><XIcon size={14} aria-hidden="true" /></button>
            </li>;
          })}
        </ul> : <p className={s.empty}>{notifications.error ? 'Updates will retry automatically.' : 'You’re all caught up.'}</p>}
      </div>
      <footer className={s.footer}>
        <button type="button" disabled={!notifications.history || notifications.saving} onClick={notifications.newest}>Newest</button>
        <button type="button" disabled={!notifications.hasOlder || notifications.saving} onClick={() => { void notifications.older(); }}>Older notifications</button>
      </footer>
    </section>}
  </div>;
}
