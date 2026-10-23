// src/routes/chat.routes.js
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createConversationHandler,
  getConversationsHandler,
  getConversationHandler,
  sendMessageHandler,
  deleteConversationHandler,
} from '../controllers/chat.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/conversations', createConversationHandler);
router.get('/conversations', getConversationsHandler);
router.get('/conversations/:id', getConversationHandler);
router.post('/conversations/:id/messages', sendMessageHandler);
router.delete('/conversations/:id', deleteConversationHandler);

export default router;
