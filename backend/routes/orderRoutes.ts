import { Router } from 'express';
import { customerAuth } from '../middleware/auth.js';
import { orderController as controller } from '../controllers/orderController.js';
import type { AppConfig } from '../types.js';
// Customer orders. Pricing and quotes are public so the cart can show real totals before sign-in.
export function orderRoutes(config: AppConfig) {
  const router = Router(); const auth = customerAuth(config);
  router.get('/pricing', controller.pricing); router.post('/quote', controller.quote);
  router.get('/', auth, controller.mine); router.post('/', auth, controller.create);
  router.get('/:id', auth, controller.get); router.post('/:id/cancel', auth, controller.cancel);
  return router;
}
