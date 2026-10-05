import { Router } from 'express';
import { customerAuth } from '../middleware/auth.js';
import { perIp } from '../middleware/rateLimit.js';
import { authController } from '../controllers/authController.js';
import type { AppConfig } from '../types.js';
import multer from 'multer';
import { customerSettingsController } from '../controllers/customerSettingsController.js';
import { HttpError } from '../middleware/errors.js';
const photo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, next) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return next(new HttpError(400, 'Choose a JPG, PNG or WebP image'));
  next(null, true);
} });
// Customer and admin sign-in are separate endpoints with separate cookies. Delivery partners sign in under /api/delivery.
// Each sign-in endpoint has its own per-IP budget (perIp); logins also lock an account after repeated failures.
export function authRoutes(config: AppConfig) {
  const router = Router(); const controller = authController(config); const customer = customerAuth(config);
  const owner: import('express').RequestHandler = (req, _res, next) => {
    const expected = req.get('X-Profile-Owner');
    if (expected && expected !== String(req.user._id)) throw new HttpError(409, 'Your account changed. Please sign in again.');
    next();
  };
  router.post('/register', perIp('register', config.authLimit), controller.register);
  router.post('/login', perIp('login', config.authLimit), controller.login);
  router.post('/logout', controller.logout);
  // Restores the sign-in after a refresh: { user: null } when nobody is signed in.
  router.get('/me', controller.current);
  router.patch('/profile', customer, owner, controller.updateProfile);
  router.patch('/profile/avatar', customer, owner, (req, res, next) => {
    photo.single('image')(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'Photos must be 5 MB or smaller'));
      next(error);
    });
  }, customerSettingsController.avatar);
  router.delete('/profile/avatar', customer, owner, customerSettingsController.removeAvatar);
  router.patch('/preferences', customer, owner, customerSettingsController.preferences);
  router.patch('/password', perIp('password', config.authLimit), customer, owner, controller.changePassword);
  router.post('/admin/login', perIp('admin-login', config.authLimit), controller.adminLogin);
  router.post('/admin/logout', controller.adminLogout);
  router.get('/admin/me', controller.adminCurrent);
  return router;
}
