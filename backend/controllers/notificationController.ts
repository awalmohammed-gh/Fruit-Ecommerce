import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import Notification, { NotificationCounter } from '../models/Notification.js';
import NotificationReceipt from '../models/NotificationReceipt.js';
import type { AccountType } from '../models/Session.js';
import { visibleNotifications, receiptLookup, unreadCount, createNotification, notificationLink, type NotificationIdentity } from '../services/notifications.js';
import { bodyObject, id, text } from '../middleware/validate.js';
import { HttpError } from '../middleware/errors.js';

export function notificationIdentity(req: Request, accountType: AccountType): NotificationIdentity {
  return { accountType, accountId: String(accountType === 'customer' ? req.user._id : accountType === 'admin' ? req.admin._id : req.deliveryPartner._id) };
}
const field = (req: Request, key: string) => {
  const value = req.query[key];
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${key} must be text`);
  return value;
};
function number(req: Request, key: string, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(field(req, key) || fallback);
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new HttpError(400, `Invalid ${key}`);
  return value;
}
const publicFields = { _id: 1, title: 1, message: 1, type: 1, link: 1, createdAt: 1, expiresAt: 1, sequence: 1, readAt: 1, isRead: { $ne: ['$readAt', null] } };

export function notificationController(accountType: AccountType) {
  const identity = (req: Request) => notificationIdentity(req, accountType);
  const allowed = async (req: Request) => {
    const notification = await Notification.findOne({ ...visibleNotifications(identity(req)), _id: id(req.params.id, 'Notification ID') });
    if (!notification) throw new HttpError(404, 'Notification not found');
    return notification;
  };
  const reply = async (req: Request, res: Response) => res.json({ unreadCount: await unreadCount(identity(req)) });
  return {
    list: async (req: Request, res: Response) => {
      const owner = identity(req);
      const incremental = req.query.since !== undefined;
      const since = number(req, 'since', 0);
      const before = number(req, 'before', Number.MAX_SAFE_INTEGER);
      const limit = number(req, 'limit', 20, 50);
      const page = number(req, 'page', 1, 10000);
      if (!limit || !page || (incremental && req.query.before !== undefined)) throw new HttpError(400, 'Invalid notification pagination');
      const watermark = (await NotificationCounter.findById('feed').lean())?.value ?? 0;
      const sequence = incremental ? { $gt: since, $lte: watermark } : { $lt: before, $lte: watermark };
      const rows = await Notification.aggregate([
        { $match: { ...visibleNotifications(owner), sequence } },
        { $sort: { sequence: incremental ? 1 : -1 } },
        ...receiptLookup(owner), { $match: { dismissedAt: null } },
        ...(incremental ? [] : [{ $skip: (page - 1) * limit }]),
        { $limit: limit + 1 }, { $project: publicFields },
      ]);
      const hasMore = rows.length > limit;
      const notifications = rows.slice(0, limit);
      // Metadata for the bounded list already in this browser synchronizes reads/dismissals in other tabs.
      const knownRaw = field(req, 'known');
      const known = knownRaw ? knownRaw.split(',') : [];
      if (known.length > 100) throw new HttpError(400, 'At most 100 notification states can be checked');
      const knownIds = known.map((value) => new mongoose.Types.ObjectId(id(value, 'Notification ID')));
      const states = knownIds.length ? await Notification.aggregate([
        { $match: { ...visibleNotifications(owner), _id: { $in: knownIds } } }, ...receiptLookup(owner),
        { $match: { dismissedAt: null } }, { $project: { _id: 1, readAt: 1, isRead: { $ne: ['$readAt', null] } } },
      ]) : [];
      res.json({
        ownerId: owner.accountId, notifications, states,
        removedIds: known.filter((value) => !states.some((state) => String(state._id) === value)),
        unreadCount: await unreadCount(owner), hasMore,
        cursor: incremental && hasMore ? notifications[notifications.length - 1]!.sequence : watermark,
        nextBefore: notifications.length ? notifications[notifications.length - 1]!.sequence : null,
      });
    },
    count: reply,
    read: async (req: Request, res: Response) => {
      const notification = await allowed(req);
      const owner = identity(req);
      await NotificationReceipt.updateOne({ notification: notification._id, ...owner }, {
        $set: { readAt: new Date() }, $setOnInsert: { expiresAt: notification.expiresAt },
      }, { upsert: true });
      await reply(req, res);
    },
    readAll: async (req: Request, res: Response) => {
      const owner = identity(req);
      bodyObject(req.body);
      if (!Array.isArray(req.body.ids) || req.body.ids.length > 100) throw new HttpError(400, 'Provide up to 100 visible notification IDs');
      const ids = req.body.ids.map((value: unknown) => new mongoose.Types.ObjectId(id(value, 'Notification ID')));
      const notifications = await Notification.find({ ...visibleNotifications(owner), _id: { $in: ids } }).select('_id expiresAt');
      const now = new Date();
      if (notifications.length) await NotificationReceipt.bulkWrite(notifications.map((notification) => ({ updateOne: {
        filter: { notification: notification._id, ...owner },
        update: { $set: { readAt: now }, $setOnInsert: { expiresAt: notification.expiresAt } }, upsert: true,
      } })));
      await reply(req, res);
    },
    dismiss: async (req: Request, res: Response) => {
      const notification = await allowed(req);
      await NotificationReceipt.updateOne({ notification: notification._id, ...identity(req) }, {
        $set: { dismissedAt: new Date(), readAt: new Date() }, $setOnInsert: { expiresAt: notification.expiresAt },
      }, { upsert: true });
      await reply(req, res);
    },
    broadcast: async (req: Request, res: Response) => {
      if (accountType !== 'admin') throw new HttpError(403, 'Only management can send broadcast notifications');
      bodyObject(req.body);
      const audience = req.body.audience;
      if (audience !== 'customers' && audience !== 'all') throw new HttpError(400, 'Audience must be customers or all');
      const notification = await createNotification({
        audience, title: text(req.body, 'title', { required: true, max: 120 }),
        message: text(req.body, 'message', { required: true, max: 1000 }),
        type: text(req.body, 'type', { required: true, max: 40 }),
        link: notificationLink(text(req.body, 'link', { max: 500 })), createdBy: identity(req).accountId,
      });
      res.status(201).json({ message: 'Notification sent', notification: { _id: notification._id, audience, title: notification.title } });
    },
  };
}
