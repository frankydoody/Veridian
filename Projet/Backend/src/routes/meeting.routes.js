import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createMeetingHandler,
  getMeetingsByProjectHandler,
  getMeetingByIdHandler,
  updateMeetingStatusHandler,
} from '../controllers/meeting.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/', createMeetingHandler);
router.get('/project/:projectId', getMeetingsByProjectHandler);
router.get('/:id', getMeetingByIdHandler);
router.patch('/:id/status', updateMeetingStatusHandler);

export default router;