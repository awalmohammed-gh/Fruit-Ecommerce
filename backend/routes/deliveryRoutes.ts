import { Router } from 'express';
import { deliveryPartnerAuth } from '../middleware/auth.js';
import { perIp } from '../middleware/rateLimit.js';
import { deliveryController } from '../controllers/deliveryController.js';
import type { AppConfig } from '../types.js';
// Delivery partners: a separate account system from customers (own login, cookie and middleware).
export function deliveryRoutes(config: AppConfig) {
  const router = Router(); const controller = deliveryController(config); const partner = deliveryPartnerAuth(config);
  // Public
  router.post('/application', perIp('partner-application', config.authLimit), controller.apply);
  router.post('/application/status', perIp('partner-status', config.authLimit), controller.status);
  router.post('/activate', perIp('partner-activate', config.authLimit), controller.activate);
  router.post('/login', perIp('partner-login', config.authLimit), controller.login); router.post('/logout', controller.logout);
  // Restores the sign-in after a refresh: { partner: null } when nobody is signed in.
  router.get('/me', controller.me);
  // Signed-in, approved and active partners
  router.get('/profile', partner, controller.profile); router.patch('/profile', partner, controller.updateProfile);
  router.get('/summary', partner, controller.summary); router.get('/deliveries', partner, controller.deliveries);
  router.get('/deliveries/:id', partner, controller.delivery);
  router.patch('/deliveries/:id/status', partner, controller.advance);
  router.post('/deliveries/:id/decline', partner, controller.decline); router.post('/deliveries/:id/fail', partner, controller.fail);
  // The customer's delivery code: limited per IP here, and per delivery in the controller.
  router.post('/deliveries/:id/deliver', perIp('delivery-code', config.authLimit), partner, controller.deliver);
  router.patch('/deliveries/:id/location', partner, controller.location);
  return router;
}
