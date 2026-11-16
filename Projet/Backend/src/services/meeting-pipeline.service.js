// src/services/meeting-pipeline.service.js
// Bloc 19 — Orchestre l'analyse complète d'une réunion :
// transcription → projets, décisions, tâches (acteurs, dates) → mémoire, contradictions,
// risques → courriels.
import { findProjectsByUser } from '../models/project.model.js';
import { findTranscriptionByMeeting } from '../models/transcription.model.js';
import {
  findKnownUsers, setAnalysisStatus, findProjectHistory, persistAnalysis, saveRisks,
} from '../models/pipeline.model.js';
import { analyzeMeeting, assessProjectRisks } from './ia.service.js';
import { indexDecisionsSafely } from './memory.service.js';
import { checkContradictionsSafely } from './contradiction.service.js';
import { buildEmails, sendEmailsSafely } from './notification.service.js';
import { normalizeAnalysis, normalizeRisks } from '../utils/analysis.utils.js';

/**
 * @param meeting  réunion déjà vérifiée (l'appelant a contrôlé l'accès)
 * @param user     { id, name, email } de la personne qui lance l'analyse (organisateur)
 * @param options  { notify: true, now: Date }
 */
export const processMeeting = async (meeting, user, { notify = true, now = new Date() } = {}) => {
  await setAnalysisStatus(meeting.id, 'processing');

  try {
    const transcription = await findTranscriptionByMeeting(meeting.id);
    if (!transcription) throw new Error('Aucune transcription disponible pour cette réunion');

    const [projects, people] = await Promise.all([findProjectsByUser(user.id), findKnownUsers(user.id)]);
    const defaultProject = projects.find((p) => p.id === meeting.project_id)
      || { id: meeting.project_id, name: meeting.project_name || 'Projet de la réunion' };

    // 1. L'IA découpe la réunion
    const raw = await analyzeMeeting(transcription.raw_text, {
      projects, people, defaultProject, today: now.toISOString().slice(0, 10),
    });
    const normalized = normalizeAnalysis(raw, { projects, users: people, defaultProject, now });

    // 2. Historique des projets existants AVANT d'écrire (pour comparer ensuite)
    const histories = new Map();
    for (const ref of normalized.projects.filter((r) => r.existing)) {
      histories.set(ref.existing.id, await findProjectHistory(ref.existing.id, meeting.id));
    }

    // 3. Enregistrement atomique : projets, décisions, tâches
    const saved = await persistAnalysis(meeting, user.id, normalized);

    // 4. Mémoire + contradictions, projet par projet
    const alerts = [];
    const risks = [];
    for (const project of saved.projects) {
      const decisions = saved.decisions.filter((d) => d.project_id === project.id);
      if (decisions.length) {
        await indexDecisionsSafely(meeting.id, project.id, decisions);
        const contradictions = await checkContradictionsSafely(meeting.id, project.id, decisions);
        alerts.push(...contradictions.alerts);
      }

      // 5. Projet existant avec historique : risques et problèmes possibles
      const history = histories.get(project.id);
      const hasHistory = history && (history.decisions.length || history.openTasks.length);
      if (!project.isNew && hasHistory) {
        try {
          const incomingTasks = normalized.tasks
            .filter((t) => t.projectKey === project.id)
            .map((t) => ({ ...t, dueDate: t.dueDate }));
          const rawRisks = await assessProjectRisks(
            { name: project.name },
            { decisions, tasks: incomingTasks },
            history
          );
          const clean = normalizeRisks(rawRisks);
          if (clean.length) risks.push(...await saveRisks(project.id, meeting.id, clean));
        } catch (e) {
          console.error('[Pipeline] Analyse des risques échouée :', e.message);
        }
      }
    }

    // 6. Courriels
    let notifications = [];
    if (notify) {
      const emails = buildEmails({
        meeting, organizer: user, projects: saved.projects,
        decisions: saved.decisions, tasks: saved.tasks, alerts, risks,
      });
      notifications = await sendEmailsSafely(meeting.id, emails);
    }

    await setAnalysisStatus(meeting.id, 'done');
    return { ...saved, alerts, risks, notifications };
  } catch (error) {
    try {
      await setAnalysisStatus(meeting.id, 'error', error.message);
    } catch (statusError) {
      console.error('[Pipeline] Statut « error » non enregistré :', statusError.message);
    }
    throw error;
  }
};

// Version « arrière-plan » : ne lance jamais d'erreur (l'état est dans meetings.analysis_status)
export const processMeetingSafely = async (meeting, user, options) => {
  try {
    return await processMeeting(meeting, user, options);
  } catch (error) {
    console.error('[Pipeline] Analyse échouée :', error.message);
    return null;
  }
};
