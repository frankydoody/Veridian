import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  getAlertsByProjectHandler,
  resolveAlertHandler,
} from '../controllers/alert.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/project/:projectId', getAlertsByProjectHandler);
router.patch('/:id/resolve', resolveAlertHandler);

export default router;
