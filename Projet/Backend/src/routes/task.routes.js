import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  getAllTasksHandler,
  createTaskHandler,
  updateTaskStatusHandler,
  deleteTaskHandler,
} from '../controllers/task.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/',            getAllTasksHandler);
router.post('/',           createTaskHandler);
router.patch('/:id/status', updateTaskStatusHandler);
router.delete('/:id',      deleteTaskHandler);

export default router;
