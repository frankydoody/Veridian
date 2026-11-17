import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createProjectHandler,
  getProjectsHandler,
  getProjectByIdHandler,
  updateProjectHandler,
  updateProjectStatusHandler,
} from '../controllers/project.controller.js';
import { exportProjectPdfHandler } from '../controllers/export.controller.js';
import {
  getMembersHandler,
  addMemberHandler,
  removeMemberHandler,
} from '../controllers/member.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/', createProjectHandler);
router.get('/', getProjectsHandler);
router.get('/:id', getProjectByIdHandler);
router.put('/:id', updateProjectHandler);
router.patch('/:id/status', updateProjectStatusHandler);
router.get('/:id/export/pdf', exportProjectPdfHandler);

// Bloc 13 : membres du projet
router.get('/:id/members', getMembersHandler);
router.post('/:id/members', addMemberHandler);
router.delete('/:id/members/:userId', removeMemberHandler);

export default router;