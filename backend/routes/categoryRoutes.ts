import { Router } from 'express';
import { adminAuth } from '../middleware/auth.js';
import { categoryController as controller } from '../controllers/categoryController.js';
import type { AppConfig } from '../types.js';
export function categoryRoutes(config: AppConfig) {
  const router = Router(); const admin = adminAuth(config);
  router.get('/', controller.publicList);
  router.get('/manage', admin, controller.list);
  router.post('/', admin, controller.create);
  router.patch('/:id', admin, controller.update);
  router.delete('/:id', admin, controller.remove);
  return router;
}
