import { query, withTransaction } from '../config/db.js';

// Colonnes renvoyées après une écriture (même forme partout)
const ALERT_COLUMNS = `id, new_decision_id, conflict_decision_id, project_id,
                       explanation, severity, resolved_at, created_at`;

// Privée : INSERT avec le client de la transaction en cours
const insertAlert = async (client, { newDecisionId, conflictDecisionId, projectId, explanation, severity }) => {
  const result = await client.query(
    `INSERT INTO alerts (new_decision_id, conflict_decision_id, project_id, explanation, severity)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${ALERT_COLUMNS}`,
    [newDecisionId, conflictDecisionId, projectId, explanation, severity]
  );
  return result.rows[0];
};

// Crée l'alerte ET marque l'ancienne décision comme « contredite » :
// les deux écritures réussissent ensemble ou échouent ensemble.
export const createAlertAndMarkConflict = async (alert) => {
  return withTransaction(async (client) => {
    const created = await insertAlert(client, alert);
    await client.query(
      `UPDATE decisions SET status = 'contradicted', updated_at = NOW() WHERE id = $1`,
      [alert.conflictDecisionId]
    );
    return created;
  });
};

// Alertes d'un projet : non résolues d'abord, puis les plus récentes.
// onlyOpen = true : seulement les alertes non résolues.
export const findAlertsByProject = async (projectId, { onlyOpen = false } = {}) => {
  const result = await query(
    `SELECT a.id, a.explanation, a.severity, a.resolved_at, a.created_at,
            nd.id AS new_decision_id,      nd.content AS new_decision,
            cd.id AS conflict_decision_id, cd.content AS conflict_decision
     FROM alerts a
     INNER JOIN decisions nd ON a.new_decision_id = nd.id
     INNER JOIN decisions cd ON a.conflict_decision_id = cd.id
     WHERE a.project_id = $1
       AND a.is_active = true
       AND ($2::boolean = false OR a.resolved_at IS NULL)
     ORDER BY (a.resolved_at IS NOT NULL), a.created_at DESC`,
    [projectId, onlyOpen]
  );
  return result.rows;
};

// Marque une alerte comme résolue, seulement si l'utilisateur est membre du projet
// de l'alerte (l'appartenance est vérifiée dans la requête elle-même).
// Idempotent : résoudre deux fois garde la première date.
export const resolveAlert = async (alertId, userId) => {
  const result = await query(
    `UPDATE alerts a
     SET resolved_at = COALESCE(a.resolved_at, NOW())
     WHERE a.id = $1
       AND a.is_active = true
       AND EXISTS (
         SELECT 1 FROM project_members pm
         WHERE pm.project_id = a.project_id
           AND pm.user_id = $2
           AND pm.is_active = true
       )
     RETURNING ${ALERT_COLUMNS}`,
    [alertId, userId]
  );
  return result.rows[0];
};
