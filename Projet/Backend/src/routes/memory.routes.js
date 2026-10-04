// src/routes/memory.routes.js
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  chatHandler,
  reindexMeetingHandler,
  getChunksHandler,
} from '../controllers/memory.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/chat', chatHandler);
router.post('/index/:meetingId', reindexMeetingHandler);
router.get('/chunks/:meetingId', getChunksHandler);

export default router;
