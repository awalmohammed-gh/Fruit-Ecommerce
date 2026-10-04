import { Router } from 'express';
import { contentController } from '../controllers/contentController.js';
// Public: the storefront reads its hero, banners and section text from here.
export function contentRoutes() {
  const router = Router();
  router.get('/', contentController.site);
  return router;
}
