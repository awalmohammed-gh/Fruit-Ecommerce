import { Router } from 'express';
import { adminAuth, customerAuth, deliveryPartnerAuth } from '../middleware/auth.js';
import { notificationController, notificationIdentity } from '../controllers/notificationController.js';
import { HttpError } from '../middleware/errors.js';
import type { AccountType } from '../models/Session.js';
import type { AppConfig } from '../types.js';

export function notificationRoutes(config: AppConfig, account: AccountType) {
  const router = Router();
  router.use((account === 'customer' ? customerAuth : account === 'admin' ? adminAuth : deliveryPartnerAuth)(config));
  router.use((req, _res, next) => {
    const expected = req.get('X-Notification-Owner');
    if (expected && expected !== notificationIdentity(req, account).accountId) throw new HttpError(409, 'Your account changed. Please sign in again.');
    next();
  });
  const notifications = notificationController(account);
  router.get('/', notifications.list);
  router.get('/unread-count', notifications.count);
  router.patch('/read-all', notifications.readAll);
  router.patch('/:id/read', notifications.read);
  router.delete('/:id', notifications.dismiss);
  router.post('/broadcast', notifications.broadcast);
  return router;
}
