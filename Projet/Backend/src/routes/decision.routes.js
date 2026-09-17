import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  extractDecisionsHandler,
  getDecisionsByMeetingHandler,
  getDecisionsByProjectHandler,
} from '../controllers/decision.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/extract/:meetingId', extractDecisionsHandler);
router.get('/meeting/:meetingId', getDecisionsByMeetingHandler);
router.get('/project/:projectId', getDecisionsByProjectHandler);

export default router;