import { Router } from 'express';
import { customerAuth } from '../middleware/auth.js';
import { addressController as controller } from '../controllers/addressController.js';
import type { AppConfig } from '../types.js';
export function addressRoutes(config: AppConfig) {
  const router = Router(); router.use(customerAuth(config));
  router.get('/', controller.list); router.post('/', controller.create);
  router.get('/:id', controller.get); router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove); router.patch('/:id/default', controller.setDefault);
  return router;
}
