// src/controllers/calendar.controller.js
// Bloc 16 — GET /api/calendar?from=AAAA-MM-JJ&to=AAAA-MM-JJ[&projectId=UUID]
// Réunions et échéances de tâches de la plage, pour l'utilisateur connecté.
import { findCalendarMeetings, findCalendarTasks } from '../models/calendar.model.js';
import { findProjectById } from '../models/project.model.js';
import { isUuid, parseCalendarRange } from '../utils/validation.utils.js';

export const getCalendarHandler = async (req, res, next) => {
  try {
    const { from, to, error } = parseCalendarRange(req.query.from, req.query.to);
    if (error) return res.status(400).json({ message: error });

    // Filtre facultatif par projet : l'appartenance est vérifiée AVANT toute lecture.
    // 404 identique pour « inexistant » et « pas membre » : on ne révèle rien.
    const projectId = req.query.projectId || null;
    if (projectId) {
      if (!isUuid(projectId)) return res.status(400).json({ message: 'Identifiant de projet invalide' });
      const project = await findProjectById(projectId, req.user.id);
      if (!project) return res.status(404).json({ message: 'Projet introuvable ou accès non autorisé' });
    }

    const filters = { userId: req.user.id, from, to, projectId };
    const [meetings, tasks] = await Promise.all([
      findCalendarMeetings(filters),
      findCalendarTasks(filters),
    ]);

    return res.status(200).json({ from, to, projectId, meetings, tasks });
  } catch (error) {
    next(error);
  }
};
