import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getCalendarHandler } from '../controllers/calendar.controller.js';

// Bloc 16 — Calendrier
const router = Router();

router.use(authMiddleware);
router.get('/', getCalendarHandler);

export default router;
