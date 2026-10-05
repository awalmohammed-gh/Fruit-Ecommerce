import mongoose, { type ClientSession, type PipelineStage, type QueryFilter } from 'mongoose';
import Notification, { NotificationCounter, type NotificationDocument } from '../models/Notification.js';
import NotificationReceipt from '../models/NotificationReceipt.js';
import type { AccountType } from '../models/Session.js';
import type { OrderDocument } from '../models/Order.js';
import { HttpError } from '../middleware/errors.js';

export interface NotificationIdentity { accountType: AccountType; accountId: string }
export interface NotificationInput {
  audience: 'individual' | 'customers' | 'all';
  recipient?: string;
  recipientAccount?: AccountType;
  title: string;
  message: string;
  type?: string;
  link?: string;
  createdBy?: string;
}

// Only root-relative storefront routes; never credentials, external redirects or script URLs.
export function notificationLink(value = '') {
  if (!value) return '';
  if (value.length > 500 || !/^\/(?!\/)/.test(value) || /[\\\s\u0000-\u001f]/.test(value))
    throw new HttpError(400, 'Use a local page path for the notification link');
  let url: URL;
  try { url = new URL(value, 'https://greenfarm.invalid'); } catch { throw new HttpError(400, 'Invalid notification link'); }
  if (url.origin !== 'https://greenfarm.invalid' || [...url.searchParams.keys()].some((key) => /(?:token|password|secret|otp|reference|credential|code)/i.test(key)))
    throw new HttpError(400, 'Notification links cannot contain credentials or private codes');
  return value;
}

export async function createNotification(input: NotificationInput, session?: ClientSession): Promise<InstanceType<typeof Notification>> {
  const link = notificationLink(input.link);
  const write = async (active: ClientSession) => {
    const counter = await NotificationCounter.findOneAndUpdate({ _id: 'feed' }, { $inc: { value: 1 } }, { session: active, returnDocument: 'after' });
    if (!counter) throw new Error('Notification counter has not been initialized');
    const [notification] = await Notification.create([{ ...input, link, sequence: counter.value }], { session: active });
    return notification!;
  };
  return session ? write(session) : mongoose.connection.transaction(write);
}

export function visibleNotifications(identity: NotificationIdentity): QueryFilter<NotificationDocument> {
  return {
    expiresAt: { $gt: new Date() },
    $or: [
      { audience: 'individual', recipientAccount: identity.accountType, recipient: identity.accountId },
      { audience: { $in: identity.accountType === 'customer' ? ['customers', 'all'] : ['all'] } },
    ],
  };
}
export function receiptLookup(identity: NotificationIdentity): PipelineStage[] {
  return [
    { $lookup: {
      from: NotificationReceipt.collection.name,
      let: { notificationId: '$_id' },
      pipeline: [{ $match: { accountType: identity.accountType, accountId: identity.accountId, $expr: { $eq: ['$notification', '$$notificationId'] } } }],
      as: 'receipt',
    } },
    { $set: { readAt: { $ifNull: [{ $first: '$receipt.readAt' }, null] }, dismissedAt: { $ifNull: [{ $first: '$receipt.dismissedAt' }, null] } } },
  ];
}
export async function unreadCount(identity: NotificationIdentity) {
  const [result] = await Notification.aggregate<{ count: number }>([
    { $match: visibleNotifications(identity) }, ...receiptLookup(identity),
    { $match: { readAt: null, dismissedAt: null } }, { $count: 'count' },
  ]);
  return result?.count ?? 0;
}

export async function notifyOrder(order: OrderDocument, status: string, session: ClientSession, notifyAdmin = false) {
  const deliveryProblem = status === 'Declined' || status === 'Failed Delivery';
  await createNotification({
    audience: 'individual', recipient: String(order.user), recipientAccount: 'customer', type: 'order',
    title: status === 'Order Placed' ? 'Order received' : deliveryProblem ? 'Delivery needs attention' : `Order ${status.toLowerCase()}`,
    message: status === 'Order Placed' ? `Your order #${order.number} has been received.` : deliveryProblem ? `GreenFarm is arranging another delivery attempt for order #${order.number}.` : `Your order #${order.number} is now ${status.toLowerCase()}.`,
    link: `/my-orders/${order._id}`,
  }, session);
  if (notifyAdmin) await createNotification({
    audience: 'individual', recipient: 'admin', recipientAccount: 'admin', type: 'order',
    title: status === 'Order Placed' ? 'New customer order' : `Order ${status.toLowerCase()}`,
    message: `Order #${order.number}: ${status.toLowerCase()}.`, link: `/admin/orders?q=${encodeURIComponent(String(order.number))}`,
  }, session);
}
