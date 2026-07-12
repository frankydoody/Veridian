import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createProjectHandler,
  getProjectsHandler,
  getProjectByIdHandler,
  updateProjectHandler,
  updateProjectStatusHandler,
} from '../controllers/project.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/', createProjectHandler);
router.get('/', getProjectsHandler);
router.get('/:id', getProjectByIdHandler);
router.put('/:id', updateProjectHandler);
router.patch('/:id/status', updateProjectStatusHandler);

export default router;