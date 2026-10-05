import { useMemo, useSyncExternalStore } from 'react';
import { notificationsApi } from '../frontApisRoute/notifications';
import type { Account } from '../frontApisRoute/session';
import { NotificationStore } from '../utils/notificationStore';

export function useNotifications(account: Account, ownerId: string) {
  const store = useMemo(() => new NotificationStore(notificationsApi(account, ownerId), ownerId, {
    visible: () => document.visibilityState !== 'hidden',
    onVisibilityChange: (listener) => { document.addEventListener('visibilitychange', listener); return () => document.removeEventListener('visibilitychange', listener); },
    schedule: (callback, delay) => window.setTimeout(callback, delay),
    cancel: (handle) => window.clearTimeout(handle as number),
  }), [account, ownerId]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...state, refresh: store.refresh, newest: store.newest, older: store.older, read: store.read, readVisible: store.readVisible, dismiss: store.dismiss };
}
