import { Router } from 'express';
import { customerAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { cartController as cart } from '../controllers/cartController.js';
import type { AppConfig } from '../types.js';

export function cartRoutes(config: AppConfig) {
  const router = Router();
  router.use(customerAuth(config));
  router.use((req, _res, next) => {
    // Detect a shared cookie changing accounts before a queued frontend request reaches the server.
    const expected = req.get('X-Cart-Owner');
    if (expected && expected !== String(req.user._id)) throw new HttpError(409, 'Your account changed. Please reload your cart.');
    next();
  });
  router.get('/', cart.list);
  router.post('/', cart.add);
  router.patch('/:productId', cart.update);
  router.delete('/:productId', cart.remove);
  router.delete('/', cart.clear);
  return router;
}
