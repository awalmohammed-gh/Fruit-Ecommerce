import { Router } from 'express';
import { adminAuth, customerAuth } from '../middleware/auth.js';
import { productController as controller } from '../controllers/productController.js';
import { reviewController as reviews } from '../controllers/reviewController.js';
import type { AppConfig } from '../types.js';
export function productRoutes(config: AppConfig) {
  const router = Router(); const admin = adminAuth(config);
  router.get('/', controller.list);
  router.get('/stats', admin, controller.stats);
  router.get('/:id', controller.get);
  router.get('/:id/reviews', reviews.list);
  router.get('/:id/reviews/mine', customerAuth(config), reviews.mine);
  router.post('/:id/reviews', customerAuth(config), reviews.save);
  router.post('/', admin, controller.create);
  router.patch('/:id', admin, controller.update);
  router.delete('/:id', admin, controller.remove);
  return router;
}
