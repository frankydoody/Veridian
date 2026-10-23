// src/controllers/export.controller.js
import { findProjectById } from '../models/project.model.js';
import { findMeetingsByProject } from '../models/meeting.model.js';
import { findDecisionsByProject } from '../models/decision.model.js';
import { findTasksByProject } from '../models/task.model.js';
import { findAlertsByProject } from '../models/alert.model.js';
import { buildProjectReportPdf, buildPdfFileName } from '../services/pdf.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/projects/:id/export/pdf
export const exportProjectPdfHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ message: 'Identifiant de projet invalide' });
    }

    // L'appartenance au projet est vérifiée AVANT de lire quoi que ce soit
    const project = await findProjectById(id, req.user.id);
    if (!project) {
      return res.status(404).json({ message: 'Projet introuvable ou accès non autorisé' });
    }

    const [meetings, decisions, tasks, alerts] = await Promise.all([
      findMeetingsByProject(id, req.user.id),
      findDecisionsByProject(id),
      findTasksByProject(id),
      findAlertsByProject(id),
    ]);

    const pdf = await buildProjectReportPdf({ project, meetings, decisions, tasks, alerts });
    const fileName = buildPdfFileName(project.name);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdf.length);
    return res.status(200).send(pdf);

  } catch (error) {
    next(error);
  }
};
