// src/services/contradiction.service.js
// Bloc 08 — Détection des contradictions entre décisions d'un même projet
import { detectContradiction } from './ia.service.js';
import { findDecisionsForComparison } from '../models/decision.model.js';
import { createAlertAndMarkConflict } from '../models/alert.model.js';

const VALID_SEVERITIES = ['low', 'medium', 'high'];

/**
 * Compare les nouvelles décisions d'une réunion aux décisions passées du projet.
 * Pour chaque contradiction trouvée : crée une alerte et marque l'ancienne
 * décision comme « contredite ».
 *
 * @returns {Array} les alertes créées
 */
export const checkContradictions = async (meetingId, projectId, newDecisions) => {
  let candidates = await findDecisionsForComparison(projectId, meetingId);
  const alerts = [];

  for (const decision of newDecisions) {
    if (candidates.length === 0) break;

    let analysis;
    try {
      analysis = await detectContradiction(decision, candidates);
    } catch (error) {
      // Une analyse qui échoue (quota, JSON invalide...) ne bloque pas les autres décisions
      console.error('[Contradictions] Analyse échouée :', error.message);
      continue;
    }

    // L'IA peut renvoyer un index hors limites : on ignore alors le résultat
    const conflict = analysis?.conflictDecision;
    if (!conflict?.id) continue;

    const alert = await createAlertAndMarkConflict({
      newDecisionId: decision.id,
      conflictDecisionId: conflict.id,
      projectId,
      explanation: analysis.explanation || 'Contradiction détectée par l\'IA.',
      severity: VALID_SEVERITIES.includes(analysis.severity) ? analysis.severity : 'medium',
    });
    alerts.push(alert);

    // L'ancienne décision est désormais caduque : inutile de la comparer à nouveau
    candidates = candidates.filter((c) => c.id !== conflict.id);
  }

  return alerts;
};

/**
 * Variante qui ne lance jamais d'erreur : la détection ne doit pas faire
 * échouer l'extraction des décisions elle-même.
 */
export const checkContradictionsSafely = async (meetingId, projectId, newDecisions) => {
  try {
    const alerts = await checkContradictions(meetingId, projectId, newDecisions);
    return { checked: true, count: alerts.length, alerts };
  } catch (error) {
    console.error('[Contradictions] Détection échouée :', error.message);
    return { checked: false, count: 0, alerts: [] };
  }
};
