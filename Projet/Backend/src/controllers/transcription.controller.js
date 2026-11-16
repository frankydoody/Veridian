import fs from 'fs';
import {
  findTranscriptionByMeeting,
  findTranscriptionById,
  updateTranscriptionText,
} from '../models/transcription.model.js';
import { findMeetingById } from '../models/meeting.model.js';
import { indexTranscriptionSafely } from '../services/memory.service.js';
import { processMeetingSafely } from '../services/meeting-pipeline.service.js';
import { saveTranscription, transcribeMeetingAudioSafely } from '../services/meeting-processing.service.js';
import { setTranscriptionStatus } from '../models/processing.model.js';
import { setAnalysisStatus } from '../models/pipeline.model.js';
import { isUuid } from '../utils/validation.utils.js';

const NOT_FOUND = { message: 'Réunion introuvable ou accès non autorisé' };
const BUSY = { message: 'Une transcription est déjà en cours pour cette réunion. Attendez qu\'elle se termine.' };

const removeFile = (filePath) => {
  if (filePath) fs.rmSync(filePath, { force: true });
};

// Lance l'analyse en arrière-plan (sauf autoAnalyze = 'false'). Ne bloque pas la réponse.
// L'état passe à « processing » AVANT de répondre (BUG-28) : sinon une interrogation
// arrivée entre la réponse et le début de l'analyse lirait « none » et arrêterait le suivi.
const startAutoAnalysis = async (meeting, user, autoAnalyze) => {
  if (String(autoAnalyze) === 'false') return { analysis_status: 'none' };
  await setAnalysisStatus(meeting.id, 'processing');
  processMeetingSafely(meeting, user);
  return { analysis_status: 'processing' };
};

// POST /api/transcriptions/upload (multipart : audio, meetingId[, autoAnalyze])
// Bloc 20 : répond 202 TOUT DE SUITE ; Whisper puis l'analyse tournent en arrière-plan.
export const uploadAndTranscribeHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier audio reçu (champ « audio »)' });
    }

    const { meetingId, autoAnalyze } = req.body ?? {};
    if (!isUuid(meetingId)) {
      removeFile(req.file.path);
      return res.status(400).json({ message: 'meetingId manquant ou invalide' });
    }

    // Accès vérifié AVANT de garder quoi que ce soit
    const meeting = await findMeetingById(meetingId, req.user.id);
    if (!meeting) {
      removeFile(req.file.path);
      return res.status(404).json(NOT_FOUND);
    }
    if (meeting.transcription_status === 'processing') {
      removeFile(req.file.path);
      return res.status(409).json(BUSY);
    }

    // L'audio ne remplacera l'ancien qu'APRÈS une transcription réussie (service d'arrière-plan)
    await setTranscriptionStatus(meeting.id, 'processing');

    // Arrière-plan : on n'attend PAS (pas de « await ») ; l'état est suivi en base
    transcribeMeetingAudioSafely(meeting, req.user, req.file.path, {
      autoAnalyze: String(autoAnalyze) !== 'false',
    });

    return res.status(202).json({
      message: 'Audio reçu. La transcription a commencé : suivez son avancement sur la page de la réunion.',
      transcription_status: 'processing',
    });
  } catch (error) {
    removeFile(req.file?.path);
    next(error);
  }
};

export const getTranscriptionHandler = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    if (!isUuid(meetingId)) return res.status(400).json({ message: 'Identifiant de réunion invalide' });

    const meeting = await findMeetingById(meetingId, req.user.id);
    if (!meeting) return res.status(404).json(NOT_FOUND);

    const transcription = await findTranscriptionByMeeting(meetingId);
    if (!transcription) {
      return res.status(404).json({ message: 'Aucune transcription pour cette réunion' });
    }

    return res.status(200).json({ message: 'Transcription récupérée avec succès', transcription });
  } catch (error) {
    next(error);
  }
};

export const updateTranscriptionHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rawText } = req.body ?? {};
    if (!isUuid(id)) return res.status(400).json({ message: 'Identifiant de transcription invalide' });

    if (!rawText || String(rawText).trim() === '') {
      return res.status(400).json({ message: 'Le texte de transcription est obligatoire' });
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
      return res.status(404).json({ message: 'Transcription introuvable ou accès non autorisé' });
    }

    // 3. Seulement maintenant, on modifie
    const transcription = await updateTranscriptionText(id, String(rawText).trim());

    // Bloc 07 : le texte a changé, la mémoire doit être ré-indexée
    const memory = await indexTranscriptionSafely(meeting.id, meeting.project_id, transcription.raw_text);

    return res.status(200).json({ message: 'Transcription mise à jour avec succès', transcription, memory });
  } catch (error) {
    next(error);
  }
};

// POST /api/transcriptions/text — transcription fournie en texte (collée ou importée) :
// remplace l'audio + Whisper, puis lance la même analyse.
export const submitTextHandler = async (req, res, next) => {
  try {
    const { meetingId, rawText, autoAnalyze } = req.body ?? {};

    if (!isUuid(meetingId) || !rawText || String(rawText).trim() === '') {
      return res.status(400).json({ message: 'meetingId et rawText sont obligatoires' });
    }
    if (String(rawText).length > 200000) {
      return res.status(400).json({ message: 'Transcription trop longue (200 000 caractères au maximum)' });
    }

    const meeting = await findMeetingById(meetingId, req.user.id);
    if (!meeting) return res.status(404).json(NOT_FOUND);
    if (meeting.transcription_status === 'processing') return res.status(409).json(BUSY);

    const text = String(rawText).trim();
    const transcription = await saveTranscription(meetingId, text);
    await setTranscriptionStatus(meetingId, 'done');

    const memory = await indexTranscriptionSafely(meetingId, meeting.project_id, text);
    const analysis = await startAutoAnalysis(meeting, req.user, autoAnalyze);

    return res.status(201).json({ message: 'Transcription enregistrée', transcription, memory, analysis });
  } catch (error) {
    next(error);
  }
};
