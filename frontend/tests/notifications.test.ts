import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationStore, NOTIFICATION_POLL_MS, type NotificationTransport, type PollingEnvironment } from '../src/utils/notificationStore.ts';
import type { AppNotification, NotificationList } from '../src/frontApisRoute/notifications.ts';

const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const notice = (sequence: number, title = 'Private update'): AppNotification => ({
  _id: sequence.toString(16).padStart(24, '0'), sequence, title, message: 'An update for this account', type: 'order',
  link: `/my-orders/${sequence}`, createdAt: '2026-10-05T12:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z', isRead: false, readAt: null,
});

function setup(ownerId = 'alice', initial: AppNotification[] = [notice(1)]) {
  let visible = true;
  let timerId = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const visibilityListeners = new Set<() => void>();
  const environment: PollingEnvironment = {
    visible: () => visible,
    onVisibilityChange: (callback) => { visibilityListeners.add(callback); return () => { visibilityListeners.delete(callback); }; },
    schedule: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    cancel: (id) => { timers.delete(id as number); },
  };
  const source = [...initial];
  const read = new Set<string>();
  const dismissed = new Set<string>();
  const calls: Parameters<NotificationTransport['list']>[0][] = [];
  const readAllCalls: string[][] = [];
  let failNext = false;
  const count = () => source.filter((item) => !read.has(item._id) && !dismissed.has(item._id)).length;
  const response = (input: Parameters<NotificationTransport['list']>[0]): NotificationList => {
    const candidates = source.filter((item) => !dismissed.has(item._id)
      && (input.since === undefined || item.sequence > input.since)
      && (input.before === undefined || item.sequence < input.before))
      .sort((a, b) => input.since === undefined ? b.sequence - a.sequence : a.sequence - b.sequence);
    const rows = candidates.slice(0, 20).map((item) => ({ ...item, isRead: read.has(item._id), readAt: read.has(item._id) ? '2026-10-05T12:01:00Z' : null }));
    const states = source.filter((item) => input.known?.includes(item._id) && !dismissed.has(item._id)).map((item) => ({ _id: item._id, isRead: read.has(item._id), readAt: read.has(item._id) ? '2026-10-05T12:01:00Z' : null }));
    return {
      ownerId, notifications: rows, unreadCount: count(), states,
      removedIds: (input.known ?? []).filter((id) => !states.some((state) => state._id === id)),
      cursor: input.since !== undefined && candidates.length > 20 ? rows.at(-1)!.sequence : Math.max(0, ...source.map((item) => item.sequence)),
      hasMore: candidates.length > 20, nextBefore: rows.at(-1)?.sequence ?? null,
    };
  };
  const api: NotificationTransport = {
    list: async (input) => { calls.push(input); if (failNext) { failNext = false; throw new Error('Temporary network interruption'); } return response(input); },
    read: async (id) => { read.add(id); return { unreadCount: count() }; },
    readAll: async (ids) => { readAllCalls.push(ids); ids.forEach((id) => read.add(id)); return { unreadCount: count() }; },
    dismiss: async (id) => { dismissed.add(id); return { unreadCount: count() }; },
  };
  const store = new NotificationStore(api, ownerId, environment);
  return {
    store, api, source, read, dismissed, calls, readAllCalls, timers, visibilityListeners,
    failNext: () => { failNext = true; },
    visibility: (value: boolean) => { visible = value; visibilityListeners.forEach((callback) => callback()); },
    tick: async () => {
      const entry = [...timers.entries()][0];
      if (entry) { timers.delete(entry[0]); entry[1].callback(); }
      await flush();
    },
  };
}

test('initial load and a 5-second incremental poll update the bell data/count without a page refresh', async () => {
  const fixture = setup();
  let updates = 0;
  const stop = fixture.store.subscribe(() => updates++);
  await flush();
  assert.equal(fixture.store.getSnapshot().unreadCount, 1);
  assert.equal(fixture.calls[0]!.since, undefined);
  assert.equal([...fixture.timers.values()][0]!.delay, NOTIFICATION_POLL_MS);
  fixture.source.push(notice(2));
  await fixture.tick();
  assert.equal(fixture.calls[1]!.since, 1);
  assert.equal(fixture.store.getSnapshot().unreadCount, 2);
  assert.deepEqual(fixture.store.getSnapshot().notifications.map((item) => item.sequence), [2, 1]);
  assert.ok(updates > 1);
  stop();
});

test('hidden tabs stop polling and becoming visible immediately fetches pending updates', async () => {
  const fixture = setup();
  const stop = fixture.store.subscribe(() => {});
  await flush();
  fixture.visibility(false);
  assert.equal(fixture.timers.size, 0);
  fixture.source.push(notice(2));
  await fixture.tick();
  assert.equal(fixture.calls.length, 1);
  fixture.visibility(true);
  await flush();
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.store.getSnapshot().unreadCount, 2);
  stop();
});

test('a page first mounted in a hidden tab defers the initial request until it is visible', async () => {
  const fixture = setup();
  fixture.visibility(false);
  const stop = fixture.store.subscribe(() => {});
  await flush();
  assert.equal(fixture.calls.length, 0);
  fixture.visibility(true);
  await flush();
  assert.equal(fixture.calls.length, 1);
  stop();
});

test('temporary polling failures retain the current list and automatically retry next interval', async () => {
  const fixture = setup();
  const stop = fixture.store.subscribe(() => {});
  await flush();
  fixture.failNext();
  await fixture.tick();
  assert.match(fixture.store.getSnapshot().error!, /network/);
  assert.equal(fixture.store.getSnapshot().notifications.length, 1);
  fixture.source.push(notice(2));
  await fixture.tick();
  assert.equal(fixture.store.getSnapshot().error, null);
  assert.equal(fixture.store.getSnapshot().unreadCount, 2);
  stop();
});

test('reading/dismissing changes in another tab synchronize on the next poll', async () => {
  const fixture = setup('alice', [notice(1), notice(2)]);
  const stop = fixture.store.subscribe(() => {});
  await flush();
  fixture.read.add(notice(1)._id);
  await fixture.tick();
  assert.equal(fixture.store.getSnapshot().notifications.find((item) => item.sequence === 1)!.isRead, true);
  assert.equal(fixture.store.getSnapshot().unreadCount, 1);
  fixture.dismissed.add(notice(2)._id);
  await fixture.tick();
  assert.deepEqual(fixture.store.getSnapshot().notifications.map((item) => item.sequence), [1]);
  assert.equal(fixture.store.getSnapshot().unreadCount, 0);
  stop();
});

test('read-on-click completes before navigation, read-visible targets the current page, and dismissal is local to the account', async () => {
  const fixture = setup('alice', [notice(1), notice(2)]);
  const stop = fixture.store.subscribe(() => {});
  await flush();
  assert.equal(await fixture.store.read(notice(2)._id), true);
  assert.equal(fixture.store.getSnapshot().notifications[0]!.isRead, true);
  await fixture.store.readVisible();
  assert.deepEqual(fixture.readAllCalls[0]!.sort(), [notice(1)._id, notice(2)._id].sort());
  assert.equal(fixture.store.getSnapshot().unreadCount, 0);
  await fixture.store.dismiss(notice(2)._id);
  assert.deepEqual(fixture.store.getSnapshot().notifications.map((item) => item.sequence), [1]);
  stop();
});

test('notification history loads bounded pages while incoming updates continue updating the badge', async () => {
  const fixture = setup('alice', Array.from({ length: 45 }, (_, index) => notice(index + 1)));
  const stop = fixture.store.subscribe(() => {});
  await flush();
  assert.equal(fixture.store.getSnapshot().notifications.length, 20);
  assert.equal(fixture.store.getSnapshot().notifications.at(-1)!.sequence, 26);
  await fixture.store.older();
  assert.equal(fixture.store.getSnapshot().history, true);
  assert.equal(fixture.calls.at(-1)!.before, 26);
  assert.equal(fixture.store.getSnapshot().notifications[0]!.sequence, 25);
  fixture.source.push(notice(46));
  await fixture.tick();
  assert.equal(fixture.store.getSnapshot().unreadCount, 46);
  assert.equal(fixture.store.getSnapshot().notifications[0]!.sequence, 25, 'polling does not interrupt the history page');
  fixture.store.newest();
  assert.equal(fixture.store.getSnapshot().notifications[0]!.sequence, 46);
  await flush();
  stop();
});

test('large notification bursts drain incremental pages promptly without loading the full history', async () => {
  const fixture = setup();
  const stop = fixture.store.subscribe(() => {});
  await flush();
  fixture.source.push(...Array.from({ length: 45 }, (_, index) => notice(index + 2)));
  await fixture.tick();
  assert.equal([...fixture.timers.values()][0]!.delay, 0);
  await fixture.tick();
  await fixture.tick();
  assert.equal(fixture.store.getSnapshot().notifications.length, 20);
  assert.equal(fixture.store.getSnapshot().notifications[0]!.sequence, 46);
  assert.equal(fixture.store.getSnapshot().unreadCount, 46);
  assert.equal([...fixture.timers.values()][0]!.delay, 5000);
  stop();
});

test('logout/unmount aborts outstanding polling, ignores late private data, and cancels timers/listeners', async () => {
  const fixture = setup();
  let finish: ((value: NotificationList) => void) | undefined;
  let signal: AbortSignal | undefined;
  fixture.api.list = (input) => { signal = input.signal; return new Promise((resolve) => { finish = resolve; }); };
  const stop = fixture.store.subscribe(() => {});
  await flush();
  stop();
  assert.equal(signal!.aborted, true);
  finish!({ ownerId: 'alice', notifications: [notice(1)], unreadCount: 1, cursor: 1, hasMore: false, nextBefore: 1, states: [], removedIds: [] });
  await flush();
  assert.deepEqual(fixture.store.getSnapshot().notifications, []);
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.visibilityListeners.size, 0);
});

test('switching accounts starts an empty store and rejects responses for the previous owner', async () => {
  const alice = setup('alice');
  const stopAlice = alice.store.subscribe(() => {});
  await flush();
  stopAlice();
  const bob = setup('bob', [notice(2, 'Bob private update')]);
  assert.deepEqual(bob.store.getSnapshot().notifications, []);
  const stopBob = bob.store.subscribe(() => {});
  await flush();
  assert.equal(bob.store.getSnapshot().notifications[0]!.title, 'Bob private update');
  const invalid = setup('bob');
  invalid.api.list = async () => ({ ownerId: 'alice', notifications: [notice(1)], unreadCount: 1, cursor: 1, hasMore: false, nextBefore: 1, states: [], removedIds: [] });
  const stopInvalid = invalid.store.subscribe(() => {});
  await flush();
  assert.deepEqual(invalid.store.getSnapshot().notifications, []);
  assert.match(invalid.store.getSnapshot().error!, /account changed/);
  stopInvalid(); stopBob();
});

test('a read that finishes after logout does not authorize navigation to the previous account’s notification', async () => {
  const fixture = setup();
  const stop = fixture.store.subscribe(() => {});
  await flush();
  let finish: ((value: { unreadCount: number }) => void) | undefined;
  fixture.api.read = () => new Promise((resolve) => { finish = resolve; });
  const reading = fixture.store.read(notice(1)._id);
  await flush();
  stop();
  finish!({ unreadCount: 0 });
  assert.equal(await reading, undefined);
});

test('subscription cleanup/restart does not leak listeners or let old requests overwrite new results', async () => {
  const fixture = setup();
  const stop = fixture.store.subscribe(() => {});
  stop();
  const stopAgain = fixture.store.subscribe(() => {});
  await flush();
  assert.equal(fixture.store.getSnapshot().unreadCount, 1);
  assert.equal(fixture.visibilityListeners.size, 1);
  assert.equal(fixture.timers.size, 1);
  stopAgain();
});

test('failed read requests retain the notification, surface the error, and never approve navigation', async () => {
  const fixture = setup();
  const stop = fixture.store.subscribe(() => {});
  await flush();
  fixture.api.read = async () => { throw new Error('Notification not found or access denied'); };
  await assert.rejects(fixture.store.read(notice(1)._id), /access denied/);
  assert.equal(fixture.store.getSnapshot().notifications[0]!.isRead, false);
  assert.match(fixture.store.getSnapshot().error!, /access denied/);
  assert.equal(fixture.store.getSnapshot().saving, false);
  stop();
});

test('dismissing all notifications on a recent page preserves access to older pages', async () => {
  const fixture = setup('alice', Array.from({ length: 25 }, (_, index) => notice(index + 1)));
  const stop = fixture.store.subscribe(() => {});
  await flush();
  for (const item of fixture.store.getSnapshot().notifications) await fixture.store.dismiss(item._id);
  assert.equal(fixture.store.getSnapshot().notifications.length, 0);
  await fixture.store.older();
  assert.deepEqual(fixture.store.getSnapshot().notifications.map((item) => item.sequence), [5, 4, 3, 2, 1]);
  stop();
});
