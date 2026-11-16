// src/models/processing.model.js
// Bloc 20 — État des traitements en arrière-plan d'une réunion (transcription Whisper, analyse IA).
import { query } from '../config/db.js';

export const setTranscriptionStatus = async (meetingId, status, error = null) => {
  await query(
    `UPDATE meetings
     SET transcription_status = $2::varchar,
         transcription_error  = $3,
         updated_at           = NOW()
     WHERE id = $1`,
    [meetingId, status, error]
  );
};

/**
 * Au démarrage du serveur : un traitement « en cours » ne peut pas l'être vraiment
 * (il tournait dans le processus précédent, qui s'est arrêté). On le marque en erreur
 * avec un message clair, pour que l'utilisateur puisse relancer.
 * @returns {{ transcriptions: number, analyses: number }}
 */
export const resetInterruptedProcessing = async () => {
  const message = 'Le serveur a redémarré pendant le traitement. Relancez-le.';
  const transcriptions = await query(
    `UPDATE meetings
     SET transcription_status = 'error', transcription_error = $1, updated_at = NOW()
     WHERE transcription_status = 'processing'`,
    [message]
  );
  const analyses = await query(
    `UPDATE meetings
     SET analysis_status = 'error', analysis_error = $1, updated_at = NOW()
     WHERE analysis_status = 'processing'`,
    [message]
  );
  return { transcriptions: transcriptions.rowCount, analyses: analyses.rowCount };
};
