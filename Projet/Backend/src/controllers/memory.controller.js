// src/controllers/memory.controller.js
import { findMeetingById } from '../models/meeting.model.js';
import { findProjectById } from '../models/project.model.js';
import { findTranscriptionByMeeting } from '../models/transcription.model.js';
import { findChunksByMeeting } from '../models/memory.model.js';
import { indexTranscription, retrieveChunks } from '../services/memory.service.js';
import { chatWithMemory } from '../services/ia.service.js';

/**
 * POST /api/memory/chat
 * Body : { question, projectId?, meetingId? } — au moins un des deux identifiants.
 * RAG complet : embedding de la question → recherche vectorielle → réponse du LLM.
 */
export const chatHandler = async (req, res, next) => {
  try {
    const { question, projectId, meetingId } = req.body ?? {};

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({
        message: 'La question est obligatoire'
      });
    }

    if (!projectId && !meetingId) {
      return res.status(400).json({
        message: 'projectId ou meetingId est obligatoire'
      });
    }

    // La recherche est toujours limitée à ce que l'utilisateur a le droit de voir
    let scope;

    if (meetingId) {
      const meeting = await findMeetingById(meetingId, req.user.id);
      if (!meeting) {
        return res.status(404).json({
          message: 'Réunion introuvable ou accès non autorisé'
        });
      }
      scope = { meetingId, projectId: meeting.project_id };
    } else {
      const project = await findProjectById(projectId, req.user.id);
      if (!project) {
        return res.status(404).json({
          message: 'Projet introuvable ou accès non autorisé'
        });
      }
      scope = { projectId };
    }

    const chunks = await retrieveChunks(question.trim(), scope);

    if (chunks.length === 0) {
      return res.status(200).json({
        message: 'Aucun extrait pertinent trouvé dans la mémoire',
        question: question.trim(),
        answer: "Je n'ai trouvé aucune information à ce sujet dans l'historique.",
        hasContext: false,
        sources: []
      });
    }

    const answer = await chatWithMemory(question.trim(), chunks);

    return res.status(200).json({
      message: 'Réponse générée avec succès',
      question: question.trim(),
      answer,
      hasContext: true,
      sources: chunks.map((c) => ({
        meetingId: c.meeting_id,
        meetingTitle: c.meeting_title,
        chunkType: c.chunk_type,
        similarity: Math.round(c.similarity * 100) / 100
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/memory/index/:meetingId
 * Ré-indexe la transcription d'une réunion dans la mémoire vectorielle.
 */
export const reindexMeetingHandler = async (req, res, next) => {
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

    const { stored } = await indexTranscription(
      meetingId,
      meeting.project_id,
      transcription.raw_text
    );

    return res.status(200).json({
      message: 'Réindexation terminée',
      meetingId,
      stored
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/memory/chunks/:meetingId
 * Liste les chunks actifs d'une réunion (inspection / débogage).
 */
export const getChunksHandler = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const meeting = await findMeetingById(meetingId, req.user.id);
    if (!meeting) {
      return res.status(404).json({
        message: 'Réunion introuvable ou accès non autorisé'
      });
    }

    const chunks = await findChunksByMeeting(meetingId);

    return res.status(200).json({
      message: 'Chunks récupérés avec succès',
      count: chunks.length,
      chunks
    });

  } catch (error) {
    next(error);
  }
};
