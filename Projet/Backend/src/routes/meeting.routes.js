import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createMeetingHandler,
  getMeetingsByProjectHandler,
  getMeetingByIdHandler,
  updateMeetingStatusHandler,
   getAllMeetingsHandler,  
} from '../controllers/meeting.controller.js';
import { analyzeMeetingHandler, getAnalysisHandler } from '../controllers/analysis.controller.js';
import { getMeetingDetailsHandler, streamMeetingAudioHandler } from '../controllers/meeting-detail.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllMeetingsHandler); 
router.post('/', createMeetingHandler);
router.get('/project/:projectId', getMeetingsByProjectHandler);
router.get('/:id', getMeetingByIdHandler);
router.patch('/:id/status', updateMeetingStatusHandler);
router.post('/:id/analyze', analyzeMeetingHandler);
router.get('/:id/analysis', getAnalysisHandler);
// Bloc 14 : page de détail d'une réunion
router.get('/:id/details', getMeetingDetailsHandler);
router.get('/:id/audio', streamMeetingAudioHandler);

export default router;