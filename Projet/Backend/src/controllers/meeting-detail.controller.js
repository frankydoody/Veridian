// src/controllers/meeting-detail.controller.js
// Bloc 14 — Page de détail d'une réunion.
//   GET /api/meetings/:id/details  réunion + transcription, décisions, tâches, alertes, risques, courriels
//   GET /api/meetings/:id/audio    fichier audio, envoyé seulement APRÈS vérification d'appartenance
// Non-membre ou réunion inexistante : 404 dans les deux cas (on ne révèle pas l'existence).
import { findMeetingById } from '../models/meeting.model.js';
import { findMeetingDetails } from '../models/meeting-detail.model.js';
import { resolveAudioPath, audioContentType } from '../config/storage.js';
import { isUuid } from '../utils/validation.utils.js';

const NOT_FOUND = { message: 'Réunion introuvable ou accès non autorisé' };

const loadMeeting = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    res.status(400).json({ message: 'Identifiant de réunion invalide' });
    return null;
  }
  const meeting = await findMeetingById(id, req.user.id);
  if (!meeting) {
    res.status(404).json(NOT_FOUND);
    return null;
  }
  return meeting;
};

export const getMeetingDetailsHandler = async (req, res, next) => {
  try {
    const meeting = await loadMeeting(req, res);
    if (!meeting) return;

    const details = await findMeetingDetails(meeting.id, req.user.id);
    // Le nom du fichier sur le disque ne regarde pas le client : seulement « y a-t-il un audio ? »
    const { audio_path: audioPath, ...publicMeeting } = meeting;

    return res.status(200).json({
      meeting: { ...publicMeeting, has_audio: Boolean(resolveAudioPath(audioPath)) },
      ...details,
    });
  } catch (error) {
    next(error);
  }
};

export const streamMeetingAudioHandler = async (req, res, next) => {
  try {
    const meeting = await loadMeeting(req, res);
    if (!meeting) return;

    const fullPath = resolveAudioPath(meeting.audio_path);
    if (!fullPath) {
      return res.status(404).json({ message: 'Aucun enregistrement audio pour cette réunion' });
    }

    // sendFile gère l'en-tête Range : le lecteur peut avancer dans l'enregistrement sans tout recharger
    return res.sendFile(fullPath, {
      headers: {
        'Content-Type': audioContentType(fullPath),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }, (err) => { if (err && !res.headersSent) next(err); });
  } catch (error) {
    next(error);
  }
};
