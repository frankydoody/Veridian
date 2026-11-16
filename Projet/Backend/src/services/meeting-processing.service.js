// src/services/meeting-processing.service.js
// Bloc 20 — Traitement en ARRIÈRE-PLAN d'un audio envoyé :
//   Whisper → transcription enregistrée → mémoire vectorielle → analyse IA (bloc 19).
// La requête HTTP d'envoi a déjà répondu 202 : l'état se suit avec meetings.transcription_status
// (puis analysis_status), lu par GET /api/meetings/:id/analysis.
import { transcribeAudio } from './whisper.service.js';
import { indexTranscriptionSafely } from './memory.service.js';
import { processMeetingSafely } from './meeting-pipeline.service.js';
import { setTranscriptionStatus } from '../models/processing.model.js';
import {
  createTranscription,
  findTranscriptionByMeeting,
  updateTranscriptionText,
} from '../models/transcription.model.js';

// Une seule transcription par réunion (meeting_id UNIQUE) : créer ou remplacer
export const saveTranscription = async (meetingId, text) => {
  const existing = await findTranscriptionByMeeting(meetingId);
  return existing
    ? updateTranscriptionText(existing.id, text)
    : createTranscription(meetingId, text);
};

/**
 * @param meeting      réunion déjà vérifiée par l'appelant (accès contrôlé)
 * @param user         organisateur (reçoit le résumé de l'analyse)
 * @param audioPath    chemin du fichier audio conservé
 * @param autoAnalyze  lancer l'analyse IA après la transcription
 */
export const transcribeMeetingAudio = async (meeting, user, audioPath, { autoAnalyze = true } = {}) => {
  await setTranscriptionStatus(meeting.id, 'processing');
  try {
    const text = await transcribeAudio(audioPath);
    if (!text) {
      throw new Error('Aucune parole détectée dans l\'enregistrement. '
        + 'Vérifiez le micro (niveau, micro choisi par le navigateur) puis réessayez.');
    }

    const transcription = await saveTranscription(meeting.id, text);
    await setTranscriptionStatus(meeting.id, 'done');

    const memory = await indexTranscriptionSafely(meeting.id, meeting.project_id, text);
    const analysis = autoAnalyze ? await processMeetingSafely(meeting, user) : null;
    return { transcription, memory, analysis };
  } catch (error) {
    try {
      await setTranscriptionStatus(meeting.id, 'error', error.message);
    } catch (statusError) {
      console.error('[Transcription] Statut « error » non enregistré :', statusError.message);
    }
    throw error;
  }
};

// Version « arrière-plan » : ne lance jamais d'erreur (l'état est en base)
export const transcribeMeetingAudioSafely = async (meeting, user, audioPath, options) => {
  try {
    return await transcribeMeetingAudio(meeting, user, audioPath, options);
  } catch (error) {
    console.error('[Transcription] Échec :', error.message);
    return null;
  }
};
