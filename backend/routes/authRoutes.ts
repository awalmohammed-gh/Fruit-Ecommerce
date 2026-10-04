import { Router } from 'express';
import { customerAuth } from '../middleware/auth.js';
import { perIp } from '../middleware/rateLimit.js';
import { authController } from '../controllers/authController.js';
import type { AppConfig } from '../types.js';
// Customer and admin sign-in are separate endpoints with separate cookies. Delivery partners sign in under /api/delivery.
// Each sign-in endpoint has its own per-IP budget (perIp); logins also lock an account after repeated failures.
export function authRoutes(config: AppConfig) {
  const router = Router(); const controller = authController(config); const customer = customerAuth(config);
  router.post('/register', perIp('register', config.authLimit), controller.register);
  router.post('/login', perIp('login', config.authLimit), controller.login);
  router.post('/logout', controller.logout);
  // Restores the sign-in after a refresh: { user: null } when nobody is signed in.
  router.get('/me', controller.current);
  router.patch('/profile', customer, controller.updateProfile);
  router.patch('/password', perIp('password', config.authLimit), customer, controller.changePassword);
  router.post('/admin/login', perIp('admin-login', config.authLimit), controller.adminLogin);
  router.post('/admin/logout', controller.adminLogout);
  router.get('/admin/me', controller.adminCurrent);
  return router;
}
