import {
  createDecisions,
  findDecisionsByMeeting,
  findDecisionsByProject,
} from '../models/decision.model.js';
import { findMeetingById } from '../models/meeting.model.js';
import { findTranscriptionByMeeting } from '../models/transcription.model.js';
import { extractDecisions } from '../services/ia.service.js';

export const extractDecisionsHandler = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const meeting = await findMeetingById(meetingId, req.user.id);
    if (!meeting) {
      return res.status(404).json({
        message: 'Réunion introuvable ou accès non autorisé'
      });
    }

    const transcription = await findTranscriptionByMeeting(meetingId);
    if (!transcription) {
      return res.status(404).json({
        message: 'Aucune transcription disponible pour cette réunion'
      });
    }

    const decisionsData = await extractDecisions(transcription.raw_text);

    if (decisionsData.length === 0) {
      return res.status(200).json({
        message: 'Aucune décision trouvée dans cette transcription',
        decisions: []
      });
    }

    const decisions = await createDecisions(meetingId, meeting.project_id, decisionsData);

    return res.status(201).json({
      message: `${decisions.length} décision(s) extraite(s) avec succès`,
      count: decisions.length,
      decisions
    });

  } catch (error) {
    next(error);
  }
};

export const getDecisionsByMeetingHandler = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const meeting = await findMeetingById(meetingId, req.user.id);
    if (!meeting) {
      return res.status(404).json({
        message: 'Réunion introuvable ou accès non autorisé'
      });
    }

    const decisions = await findDecisionsByMeeting(meetingId);

    return res.status(200).json({
      message: 'Décisions récupérées avec succès',
      count: decisions.length,
      decisions
    });

  } catch (error) {
    next(error);
  }
};

export const getDecisionsByProjectHandler = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const decisions = await findDecisionsByProject(projectId);

    return res.status(200).json({
      message: 'Décisions du projet récupérées avec succès',
      count: decisions.length,
      decisions
    });

  } catch (error) {
    next(error);
  }
};