import { findAlertsByProject, resolveAlert } from '../models/alert.model.js';
import { findProjectById } from '../models/project.model.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/alerts/project/:projectId[?status=open]
export const getAlertsByProjectHandler = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!UUID_REGEX.test(projectId)) {
      return res.status(400).json({ message: 'Identifiant de projet invalide' });
    }

    // L'appartenance au projet est vérifiée AVANT de lire quoi que ce soit
    const project = await findProjectById(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({
        message: 'Projet introuvable ou accès non autorisé'
      });
    }

    const onlyOpen = req.query.status === 'open';
    const alerts = await findAlertsByProject(projectId, { onlyOpen });

    return res.status(200).json({
      message: 'Alertes du projet récupérées avec succès',
      count: alerts.length,
      openCount: alerts.filter((a) => !a.resolved_at).length,
      alerts
    });

  } catch (error) {
    next(error);
  }
};

// PATCH /api/alerts/:id/resolve
export const resolveAlertHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ message: 'Identifiant d\'alerte invalide' });
    }

    // Même message pour « n'existe pas » et « pas membre du projet » :
    // on ne révèle pas l'existence d'une alerte à un non-membre.
    const alert = await resolveAlert(id, req.user.id);
    if (!alert) {
      return res.status(404).json({
        message: 'Alerte introuvable ou accès non autorisé'
      });
    }

    return res.status(200).json({
      message: 'Alerte marquée comme résolue',
      alert
    });

  } catch (error) {
    next(error);
  }
};
