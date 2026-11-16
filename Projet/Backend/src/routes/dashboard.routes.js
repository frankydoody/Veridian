import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getDashboardHandler } from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getDashboardHandler);

export default router;
