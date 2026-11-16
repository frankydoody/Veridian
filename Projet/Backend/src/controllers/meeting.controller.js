import {
  createMeetingWithHost,
  findMeetingsByProject,
  findMeetingById,
  updateMeetingStatus,
  findAllMeetings,  
} from '../models/meeting.model.js';
import { findProjectById } from '../models/project.model.js';
import { isUuid, cleanText } from '../utils/validation.utils.js';


export const createMeetingHandler = async (req, res, next) => {
  try {
    const { projectId } = req.body ?? {};
    if (!projectId) return res.status(400).json({ message: 'Le projet est obligatoire' });
    if (!isUuid(projectId)) return res.status(400).json({ message: 'Identifiant de projet invalide' });

    const titleField = cleanText(req.body.title, { label: 'Le titre', max: 200, required: true });
    if (titleField.error) return res.status(400).json({ message: titleField.error });
    const descriptionField = cleanText(req.body.description, { label: 'La description', max: 2000 });
    if (descriptionField.error) return res.status(400).json({ message: descriptionField.error });
    const title = titleField.value;
    const description = descriptionField.value;

    const project = await findProjectById(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({
        message: 'Projet introuvable ou accès non autorisé'
      });
    }

    const meeting = await createMeetingWithHost(
      projectId,
      title,
      description,
      req.user.id
    );

    return res.status(201).json({
      message: 'Réunion créée avec succès',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

export const getAllMeetingsHandler = async (req, res, next) => {
  try {
    const meetings = await findAllMeetings(req.user.id);

    return res.status(200).json({
      message: 'Réunions récupérées avec succès',
      count: meetings.length,
      meetings,
    });

  } catch (error) {
    next(error);
  }
};

export const getMeetingsByProjectHandler = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isUuid(projectId)) return res.status(400).json({ message: 'Identifiant de projet invalide' });

    const project = await findProjectById(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({
        message: 'Projet introuvable ou accès non autorisé'
      });
    }

    const meetings = await findMeetingsByProject(projectId, req.user.id);

    return res.status(200).json({
      message: 'Réunions récupérées avec succès',
      count: meetings.length,
      meetings
    });

  } catch (error) {
    next(error);
  }
};

export const getMeetingByIdHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ message: 'Identifiant de réunion invalide' });

    const meeting = await findMeetingById(id, req.user.id);

    if (!meeting) {
      return res.status(404).json({
        message: 'Réunion introuvable ou accès non autorisé'
      });
    }

    return res.status(200).json({
      message: 'Réunion récupérée avec succès',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

export const updateMeetingStatusHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ message: 'Identifiant de réunion invalide' });
    const { status } = req.body;

    const validStatuses = ['planned', 'active', 'processing', 'done', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}`
      });
    }

    const meeting = await findMeetingById(id, req.user.id);

    if (!meeting) {
      return res.status(404).json({
        message: 'Réunion introuvable ou accès non autorisé'
      });
    }

    const updatedMeeting = await updateMeetingStatus(id, status);

    return res.status(200).json({
      message: 'Statut mis à jour avec succès',
      meeting: updatedMeeting
    });

  } catch (error) {
    next(error);
  }
};


