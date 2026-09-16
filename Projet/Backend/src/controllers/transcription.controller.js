import fs from 'fs';
import {
  createTranscription,
  findTranscriptionByMeeting,
  updateTranscriptionText,
} from '../models/transcription.model.js';
import { findMeetingById } from '../models/meeting.model.js';
import { transcribeAudio } from '../services/whisper.service.js';

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

    return res.status(201).json({
      message: 'Audio transcrit avec succès',
      transcription
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

    const transcription = await updateTranscriptionText(id, rawText.trim());

    if (!transcription) {
      return res.status(404).json({
        message: 'Transcription introuvable'
      });
    }

    return res.status(200).json({
      message: 'Transcription mise à jour avec succès',
      transcription
    });

  } catch (error) {
    next(error);
  }
};