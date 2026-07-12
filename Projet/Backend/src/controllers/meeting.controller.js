import {
  createMeetingWithHost,
  findMeetingsByProject,
  findMeetingById,
  updateMeetingStatus,
} from '../models/meeting.model.js';
import { findProjectById } from '../models/project.model.js';


export const createMeetingHandler = async (req, res, next) => {
  try {
    const { projectId, title, description } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({
        message: 'Le projet et le titre sont obligatoires'
      });
    }

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


export const getMeetingsByProjectHandler = async (req, res, next) => {
  try {
    const { projectId } = req.params;

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


