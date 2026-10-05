import type { AppNotification, NotificationList } from '../frontApisRoute/notifications';

export interface NotificationTransport {
  list: (input: { since?: number; before?: number; known?: string[]; signal: AbortSignal }) => Promise<NotificationList>;
  read: (id: string, signal: AbortSignal) => Promise<{ unreadCount: number }>;
  readAll: (ids: string[], signal: AbortSignal) => Promise<{ unreadCount: number }>;
  dismiss: (id: string, signal: AbortSignal) => Promise<{ unreadCount: number }>;
}
export interface PollingEnvironment {
  visible: () => boolean;
  onVisibilityChange: (listener: () => void) => () => void;
  schedule: (callback: () => void, delay: number) => unknown;
  cancel: (handle: unknown) => void;
}
export interface NotificationState {
  notifications: AppNotification[]; unreadCount: number; loading: boolean; saving: boolean;
  error: string | null; hasOlder: boolean; history: boolean;
}
export const NOTIFICATION_POLL_MS = 5000;
const errorMessage = (failure: unknown) => failure instanceof Error ? failure.message : 'Unable to load notifications';

// One in-memory store per authenticated header/account. No browser storage, sockets or server timers.
export class NotificationStore {
  private state: NotificationState = { notifications: [], unreadCount: 0, loading: true, saving: false, error: null, hasOlder: false, history: false };
  private recent: AppNotification[] = [];
  private recentHasOlder = false;
  private recentBefore: number | undefined;
  private historyBefore: number | undefined;
  private cursor: number | undefined;
  private listeners = new Set<() => void>();
  private active = false;
  private generation = 0;
  private controller = new AbortController();
  private timer: unknown;
  private unsubscribeVisibility?: () => void;
  private queue: Promise<unknown> = Promise.resolve();
  private pollingGeneration: number | null = null;
  private api: NotificationTransport;
  private ownerId: string;
  private environment: PollingEnvironment;
  constructor(api: NotificationTransport, ownerId: string, environment: PollingEnvironment) {
    this.api = api;
    this.ownerId = ownerId;
    this.environment = environment;
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.active) {
      this.active = true;
      this.generation++;
      this.controller = new AbortController();
      this.unsubscribeVisibility = this.environment.onVisibilityChange(() => {
        this.clearTimer();
        if (this.environment.visible()) void this.poll();
      });
      if (this.environment.visible()) void this.poll();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size) return;
      this.active = false;
      this.generation++;
      this.controller.abort();
      this.clearTimer();
      this.unsubscribeVisibility?.();
    };
  };
  private publish(change: Partial<NotificationState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
  private clearTimer() {
    if (this.timer !== undefined) this.environment.cancel(this.timer);
    this.timer = undefined;
  }
  private run<T>(work: (signal: AbortSignal, current: () => boolean) => Promise<T>) {
    const generation = this.generation;
    const current = () => this.active && this.generation === generation;
    const task = this.queue.catch(() => {}).then(async () => {
      if (current()) return work(this.controller.signal, current);
    });
    this.queue = task;
    return task;
  }
  private synchronize(result: NotificationList) {
    if (result.ownerId !== this.ownerId) throw new Error('Your account changed. Reload notifications.');
    const removed = new Set(result.removedIds);
    const states = new Map(result.states.map((state) => [state._id, state]));
    const sync = (items: AppNotification[]) => items.filter((item) => !removed.has(item._id)).map((item) => ({ ...item, ...states.get(item._id) }));
    this.recent = sync(this.recent);
    this.publish({ notifications: sync(this.state.notifications), unreadCount: result.unreadCount });
  }
  private known() { return [...new Set([...this.recent, ...this.state.notifications].map((item) => item._id))]; }
  private async poll() {
    if (!this.active || !this.environment.visible() || this.pollingGeneration === this.generation) return;
    const generation = this.generation;
    this.clearTimer();
    this.pollingGeneration = generation;
    let more = false;
    try {
      await this.run(async (signal, current) => {
        const initial = this.cursor === undefined;
        const result = await this.api.list({ ...(initial ? {} : { since: this.cursor }), known: this.known(), signal });
        if (!current()) return;
        this.synchronize(result);
        const merged = new Map([...this.recent, ...result.notifications].map((item) => [item._id, item]));
        const sorted = [...merged.values()].sort((a, b) => b.sequence - a.sequence);
        this.recent = sorted.slice(0, 20);
        this.recentBefore = this.recent.at(-1)?.sequence ?? this.recentBefore;
        this.recentHasOlder = initial ? result.hasMore : this.recentHasOlder || sorted.length > 20;
        this.cursor = result.cursor;
        more = !initial && result.hasMore;
        this.publish({
          loading: false, error: null,
          ...(!this.state.history && { notifications: this.recent, hasOlder: this.recentHasOlder }),
        });
      });
    } catch (failure) {
      if (this.active && this.generation === generation) this.publish({ loading: false, error: errorMessage(failure) });
    } finally {
      if (this.pollingGeneration === generation) this.pollingGeneration = null;
      if (this.active && this.generation === generation && this.environment.visible()) this.timer = this.environment.schedule(() => { void this.poll(); }, more ? 0 : NOTIFICATION_POLL_MS);
    }
  }
  refresh = () => { void this.poll(); };
  newest = () => {
    this.publish({ history: false, notifications: this.recent, hasOlder: this.recentHasOlder });
    this.refresh();
  };
  older = () => this.run(async (signal, current) => {
    const before = this.state.history ? this.historyBefore : this.recentBefore;
    if (before === undefined) return;
    this.publish({ saving: true });
    try {
      const result = await this.api.list({ before, known: this.known(), signal });
      if (!current()) return;
      this.synchronize(result);
      this.historyBefore = result.nextBefore ?? undefined;
      this.publish({ notifications: result.notifications, history: true, hasOlder: result.hasMore, error: null });
    } catch (failure) { if (current()) this.publish({ error: errorMessage(failure) }); }
    finally { if (current()) this.publish({ saving: false }); }
  });
  private mutate(work: (signal: AbortSignal) => Promise<{ unreadCount: number }>, update: (items: AppNotification[]) => AppNotification[]) {
    return this.run(async (signal, current) => {
      this.publish({ saving: true });
      try {
        const result = await work(signal);
        if (!current()) return;
        this.recent = update(this.recent);
        this.publish({ notifications: update(this.state.notifications), unreadCount: result.unreadCount, error: null });
        return true;
      } catch (failure) {
        if (!current()) return;
        this.publish({ error: errorMessage(failure) });
        throw failure;
      } finally { if (current()) this.publish({ saving: false }); }
    });
  }
  read = (id: string) => this.mutate((signal) => this.api.read(id, signal), (items) => items.map((item) => item._id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item));
  readVisible = () => {
    const ids = this.state.notifications.map((item) => item._id);
    const selected = new Set(ids);
    return this.mutate((signal) => this.api.readAll(ids, signal), (items) => items.map((item) => selected.has(item._id) ? { ...item, isRead: true, readAt: new Date().toISOString() } : item));
  };
  dismiss = (id: string) => this.mutate((signal) => this.api.dismiss(id, signal), (items) => items.filter((item) => item._id !== id));
}
