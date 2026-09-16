import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadAudio } from '../middlewares/upload.middleware.js';
import {
  uploadAndTranscribeHandler,
  getTranscriptionHandler,
  updateTranscriptionHandler,
} from '../controllers/transcription.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/upload', uploadAudio, uploadAndTranscribeHandler);
router.get('/meeting/:meetingId', getTranscriptionHandler);
router.put('/:id', updateTranscriptionHandler);

export default router;


