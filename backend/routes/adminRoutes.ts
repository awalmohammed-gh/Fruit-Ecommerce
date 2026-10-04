import { Router } from 'express';
import { adminAuth } from '../middleware/auth.js';
import { upload } from '../middleware/multer.js';
import { customerController as customers } from '../controllers/customerController.js';
import { uploadController } from '../controllers/uploadController.js';
import { adminOrderController as orders } from '../controllers/adminOrderController.js';
import { deliveryAdminController } from '../controllers/deliveryAdminController.js';
import { contentController as content } from '../controllers/contentController.js';
import type { AppConfig } from '../types.js';
import { adminSettingsController } from '../controllers/adminSettingsController.js';
import { perIp } from '../middleware/rateLimit.js';
// Everything here is admin-only management data.
export function adminRoutes(config: AppConfig) {
  const router = Router(); router.use(adminAuth(config)); const delivery = deliveryAdminController(config);
  const settings = adminSettingsController(config);
  router.patch('/account/profile', settings.profile);
  router.patch('/account/password', perIp('admin-password', config.authLimit), settings.password);
  router.get('/preferences', settings.preferences);
  router.patch('/preferences', settings.savePreferences);
  router.get('/customers', customers.list); router.get('/customers/stats', customers.stats);
  router.get('/customers/:id', customers.get); router.patch('/customers/:id/status', customers.setStatus);
  router.post('/uploads/image', upload.single('image'), uploadController.image);
  router.get('/orders', orders.list); router.get('/orders/summary', orders.summary);
  router.get('/orders/revenue', orders.revenue); router.get('/orders/products', orders.productRevenue);
  router.get('/orders/:id', orders.get); router.patch('/orders/:id/status', orders.updateStatus); router.patch('/orders/:id/partner', delivery.assign);
  // Delivery management: applications, partners and the assignments they carry.
  router.get('/delivery/applications', delivery.applications); router.get('/delivery/applications/:id', delivery.application);
  router.patch('/delivery/applications/:id/status', delivery.review); router.post('/delivery/applications/:id/activation-code', delivery.activationCode);
  router.get('/delivery/partners', delivery.partners);
  router.get('/delivery/assignments', delivery.assignments); router.get('/delivery/assignments/:id', delivery.assignment);
  // Storefront content (Settings): hero, store info, section text, ads, and promotional banners.
  router.get('/content', content.get); router.put('/content/:block', content.save);
  router.get('/banners', content.banners); router.post('/banners', content.createBanner);
  router.put('/banners/:id', content.updateBanner); router.patch('/banners/:id/status', content.setBannerActive); router.delete('/banners/:id', content.removeBanner);
  return router;
}
