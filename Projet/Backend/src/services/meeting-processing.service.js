// src/services/meeting-processing.service.js
// Bloc 20 — Traitement en ARRIÈRE-PLAN d'un audio envoyé :
//   Whisper → transcription enregistrée → mémoire vectorielle → analyse IA (bloc 19).
// La requête HTTP d'envoi a déjà répondu 202 : l'état se suit avec meetings.transcription_status
// (puis analysis_status), lu par GET /api/meetings/:id/analysis.
import fs from 'fs';
import path from 'path';
import { transcribeAudio } from './whisper.service.js';
import { setMeetingAudio } from '../models/meeting-detail.model.js';
import { resolveAudioPath } from '../config/storage.js';
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
  let adopted = false; // le nouvel audio est-il devenu celui de la réunion ?
  try {
    const text = await transcribeAudio(audioPath);
    if (!text) {
      throw new Error('Aucune parole détectée dans l\'enregistrement. '
        + 'Vérifiez le micro (niveau, micro choisi par le navigateur) puis réessayez.');
    }

    const transcription = await saveTranscription(meeting.id, text);

    // L'audio n'est adopté qu'APRÈS une transcription réussie : audio et texte restent cohérents.
    // L'ancien enregistrement (s'il y en avait un) est alors supprimé.
    const previousAudio = resolveAudioPath(meeting.audio_path);
    await setMeetingAudio(meeting.id, path.basename(audioPath));
    adopted = true;
    if (previousAudio && previousAudio !== path.resolve(audioPath)) fs.rmSync(previousAudio, { force: true });

    await setTranscriptionStatus(meeting.id, 'done');

    const memory = await indexTranscriptionSafely(meeting.id, meeting.project_id, text);
    const analysis = autoAnalyze ? await processMeetingSafely(meeting, user) : null;
    return { transcription, memory, analysis };
  } catch (error) {
    // Échec avant l'adoption : le nouveau fichier est supprimé, l'ancien enregistrement reste
    if (!adopted) fs.rmSync(audioPath, { force: true });
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
