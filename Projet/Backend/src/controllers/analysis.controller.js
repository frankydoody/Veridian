// src/controllers/analysis.controller.js
// Bloc 19 — Lancer et consulter l'analyse IA d'une réunion
import { findMeetingById } from '../models/meeting.model.js';
import { findTranscriptionByMeeting } from '../models/transcription.model.js';
import { findAnalysisByMeeting, setAnalysisStatus } from '../models/pipeline.model.js';
import { processMeeting, processMeetingSafely } from '../services/meeting-pipeline.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/meetings/:id/analyze[?wait=true&notify=false]
// Par défaut : démarre l'analyse en arrière-plan (202) ; le suivi se fait avec GET /:id/analysis.
export const analyzeMeetingHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ message: 'Identifiant de réunion invalide' });

    const meeting = await findMeetingById(id, req.user.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Réunion introuvable ou accès non autorisé' });
    }

    if (meeting.transcription_status === 'processing') {
      return res.status(409).json({ message: "La transcription est encore en cours : l'analyse démarrera ensuite" });
    }
    if (meeting.analysis_status === 'processing') {
      return res.status(409).json({ message: 'Une analyse est déjà en cours pour cette réunion' });
    }

    const transcription = await findTranscriptionByMeeting(id);
    if (!transcription) {
      return res.status(404).json({ message: 'Aucune transcription disponible pour cette réunion' });
    }

    const options = { notify: req.query.notify !== 'false' };

    if (req.query.wait === 'true') {
      const result = await processMeeting(meeting, req.user, options);
      return res.status(200).json({ message: 'Analyse terminée', analysis_status: 'done', ...result });
    }

    // Arrière-plan : on ne fait pas attendre l'utilisateur pendant les appels à l'IA
    // « processing » enregistré AVANT de répondre : le suivi ne peut pas lire un état périmé (BUG-28)
    await setAnalysisStatus(meeting.id, 'processing');
    processMeetingSafely(meeting, req.user, options);
    return res.status(202).json({ message: 'Analyse démarrée', analysis_status: 'processing' });
  } catch (error) {
    next(error);
  }
};

// GET /api/meetings/:id/analysis
export const getAnalysisHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ message: 'Identifiant de réunion invalide' });

    const meeting = await findMeetingById(id, req.user.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Réunion introuvable ou accès non autorisé' });
    }

    const results = await findAnalysisByMeeting(id);
    return res.status(200).json({
      transcription_status: meeting.transcription_status,
      transcription_error: meeting.transcription_error,
      analysis_status: meeting.analysis_status,
      analysis_error: meeting.analysis_error,
      analyzed_at: meeting.analyzed_at,
      ...results,
    });
  } catch (error) {
    next(error);
  }
};
