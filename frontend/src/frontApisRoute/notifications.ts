import { ApiError, apiRequest } from './client';
import { PARTNER_BLOCKED_EVENT } from './delivery';
import type { Account } from './session';
import type { NotificationTransport } from '../utils/notificationStore';

export interface AppNotification {
  _id: string; title: string; message: string; type: string; link: string;
  createdAt: string; expiresAt: string; sequence: number; isRead: boolean; readAt: string | null;
}
export interface NotificationList {
  ownerId: string; notifications: AppNotification[]; unreadCount: number; cursor: number;
  hasMore: boolean; nextBefore: number | null;
  states: { _id: string; isRead: boolean; readAt: string | null }[]; removedIds: string[];
}
export interface BroadcastInput { title: string; message: string; audience: 'customers' | 'all'; type: string; link: string }
const root = (account: Account) => account === 'admin' ? '/admin/notifications' : account === 'partner' ? '/delivery/notifications' : '/notifications';

export function notificationsApi(account: Account, ownerId: string): NotificationTransport {
  const request = async <T>(path: string, method: string, signal: AbortSignal, body?: object) => {
    try {
      return await apiRequest<T>(`${root(account)}${path}`, {
        method, signal, headers: { 'X-Notification-Owner': ownerId }, ...(body && { body: JSON.stringify(body) }),
      });
    } catch (failure) {
      if (account === 'partner' && failure instanceof ApiError && failure.status === 403)
        window.dispatchEvent(new Event(PARTNER_BLOCKED_EVENT));
      throw failure;
    }
  };
  return {
    list: ({ since, before, known = [], signal }) => {
      const query = new URLSearchParams({ limit: '20' });
      if (since !== undefined) query.set('since', String(since));
      if (before !== undefined) query.set('before', String(before));
      if (known.length) query.set('known', known.join(','));
      return request<NotificationList>(`?${query}`, 'GET', signal);
    },
    read: (id, signal) => request(`/${encodeURIComponent(id)}/read`, 'PATCH', signal),
    readAll: (ids, signal) => request('/read-all', 'PATCH', signal, { ids }),
    dismiss: (id, signal) => request(`/${encodeURIComponent(id)}`, 'DELETE', signal),
  };
}
export const broadcastNotification = (input: BroadcastInput) => apiRequest<{ message: string }>('/admin/notifications/broadcast', { method: 'POST', body: JSON.stringify(input) });
