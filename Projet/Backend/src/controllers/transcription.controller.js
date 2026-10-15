import fs from 'fs';
import {
  createTranscription,
  findTranscriptionByMeeting,
  findTranscriptionById,
  updateTranscriptionText,
} from '../models/transcription.model.js';
import { findMeetingById } from '../models/meeting.model.js';
import { transcribeAudio } from '../services/whisper.service.js';
import { indexTranscriptionSafely } from '../services/memory.service.js';

export const uploadAndTranscribeHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Aucun fichier audio reçu'
      });
    }

    const { meetingId } = req.body;

    if (!meetingId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: 'meetingId est obligatoire'
      });
    }

    const meeting = await findMeetingById(meetingId, req.user.id);

    if (!meeting) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        message: 'Réunion introuvable ou accès non autorisé'
      });
    }

    const text = await transcribeAudio(req.file.path);

    fs.unlinkSync(req.file.path);

    const transcription = await createTranscription(meetingId, text);

    // Bloc 07 : la transcription entre dans la mémoire vectorielle
    const memory = await indexTranscriptionSafely(meetingId, meeting.project_id, text);

    return res.status(201).json({
      message: 'Audio transcrit avec succès',
      transcription,
      memory
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

export const getTranscriptionHandler = async (req, res, next) => {
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
        message: 'Aucune transcription pour cette réunion'
      });
    }

    return res.status(200).json({
      message: 'Transcription récupérée avec succès',
      transcription
    });

  } catch (error) {
    next(error);
  }
};

export const updateTranscriptionHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rawText } = req.body;

    if (!rawText || rawText.trim() === '') {
      return res.status(400).json({
        message: 'Le texte de transcription est obligatoire'
      });
    }

    // 1. La transcription existe-t-elle ?
    const existing = await findTranscriptionById(id);

    // 2. L'utilisateur est-il membre du projet de sa réunion ? (AVANT toute modification)
    //    Même message pour « inexistante » et « non autorisée » : on ne révèle pas
    //    l'existence d'une transcription à quelqu'un qui n'y a pas accès.
    const meeting = existing
      ? await findMeetingById(existing.meeting_id, req.user.id)
      : null;

    if (!existing || !meeting) {
      return res.status(404).json({
        message: 'Transcription introuvable ou accès non autorisé'
      });
    }

    // 3. Seulement maintenant, on modifie
    const transcription = await updateTranscriptionText(id, rawText.trim());

    // Bloc 07 : le texte a changé, la mémoire doit être ré-indexée
    const memory = await indexTranscriptionSafely(
      meeting.id,
      meeting.project_id,
      transcription.raw_text
    );

    return res.status(200).json({
      message: 'Transcription mise à jour avec succès',
      transcription,
      memory
    });

  } catch (error) {
    next(error);
  }
};