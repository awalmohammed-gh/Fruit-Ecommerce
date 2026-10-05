import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircleIcon, SendIcon } from 'lucide-react';
import Panel from '../../../components/admin/Panel';
import { broadcastNotification, type BroadcastInput } from '../../../frontApisRoute/notifications';
import { TextField } from './fields';
import ui from '../../../components/admin/ui.module.css';
import s from './settings.module.css';

const EMPTY: BroadcastInput = { title: '', message: '', audience: 'customers', type: 'system', link: '' };
export default function NotificationSettings({ onDirty }: { onDirty: (section: string, dirty: boolean) => void }) {
  const [draft, setDraft] = useState<BroadcastInput>(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const dirty = draft.title !== '' || draft.message !== '' || draft.link !== '';
  useEffect(() => onDirty('notifications', dirty), [dirty, onDirty]);
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || !draft.title.trim() || !draft.message.trim() || !draft.type.trim()) return;
    setSending(true);
    setError('');
    setSent('');
    try {
      await broadcastNotification(draft);
      setSent(`“${draft.title.trim()}” sent to ${draft.audience === 'customers' ? 'all customers' : 'everyone'}.`);
      setDraft(EMPTY);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to send this notification'); }
    finally { setSending(false); }
  };
  return <Panel title="Send a notification" description="Share opening hours, offers and store updates. Each recipient can read or dismiss their own copy.">
    <form onSubmit={send} className={s.fields}>
      {error && <p role="alert" className={s.error}>{error}</p>}
      {sent && <p role="status" className={ui.hint}>{sent}</p>}
      <fieldset disabled={sending} className={s.fields} style={{ border: 0, padding: 0, margin: 0 }}>
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} max={120} placeholder="Holiday opening hours" />
        <TextField label="Message" value={draft.message} onChange={(message) => setDraft({ ...draft, message })} max={1000} multiline placeholder="GreenFarm will close at 4 PM on Friday." />
        <div className={ui.field}>
          <label htmlFor="notification-audience" className={ui.label}>Audience</label>
          <select id="notification-audience" className={ui.select} value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as BroadcastInput['audience'] })}>
            <option value="customers">All customers</option><option value="all">Everyone</option>
          </select>
          <p className={ui.hint}>{draft.audience === 'customers' ? 'Customer accounts only.' : 'Customers, the administrator and delivery partners.'}</p>
        </div>
        <TextField label="Type" value={draft.type} onChange={(type) => setDraft({ ...draft, type })} max={40} options={['system', 'promotion', 'account', 'order', 'payment', 'inquiry', 'stock', 'security'].map((value) => ({ value, label: value }))} />
        <TextField label="Page link" optional value={draft.link} onChange={(link) => setDraft({ ...draft, link })} max={500} placeholder="/deals" hint="Optional page within GreenFarm. Recipients open it when they click the notification." />
      </fieldset>
      <div><button type="submit" className={`${ui.button} ${ui.primary}`} disabled={sending || !draft.title.trim() || !draft.message.trim() || !draft.type.trim()}>
        {sending ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <SendIcon size={16} aria-hidden="true" />}{sending ? 'Sending…' : 'Send notification'}
      </button></div>
    </form>
  </Panel>;
}
