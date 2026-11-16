// src/models/dashboard.model.js
// Bloc 21 — Compteurs réels du tableau de bord, limités aux projets dont l'utilisateur est membre.
//
// « En retard » : l'échéance (jour, en UTC) est passée et la tâche n'est pas terminée.
// Même définition que le frontend (utils/dates.js, isOverdue) : une tâche due aujourd'hui
// n'est pas encore en retard.
import { query } from '../config/db.js';

const MY_PROJECTS = `
  SELECT pm.project_id FROM project_members pm
  INNER JOIN projects p ON p.id = pm.project_id AND p.is_active = true
  WHERE pm.user_id = $1 AND pm.is_active = true`;

const OVERDUE = `t.status <> 'done' AND t.due_date IS NOT NULL
  AND (t.due_date AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE 'UTC')::date`;

export const findDashboardSummary = async (userId) => {
  const counts = await query(
    `SELECT
       (SELECT COUNT(*) FROM projects p
          WHERE p.id IN (${MY_PROJECTS}) AND p.status = 'active')                         AS active_projects,
       (SELECT COUNT(*) FROM meetings m
          WHERE m.project_id IN (${MY_PROJECTS}) AND m.is_active = true
            AND m.created_at >= date_trunc('month', NOW()))                              AS meetings_this_month,
       (SELECT COUNT(*) FROM meetings m
          WHERE m.project_id IN (${MY_PROJECTS}) AND m.is_active = true
            AND (m.transcription_status = 'processing' OR m.analysis_status = 'processing')) AS meetings_processing,
       (SELECT COUNT(*) FROM tasks t
          WHERE t.is_active = true AND t.assignee_id = $1 AND t.status <> 'done')       AS my_open_tasks,
       (SELECT COUNT(*) FROM tasks t
          WHERE t.is_active = true AND t.assignee_id = $1 AND ${OVERDUE})               AS my_overdue_tasks,
       (SELECT COUNT(*) FROM tasks t
          WHERE t.is_active = true AND t.project_id IN (${MY_PROJECTS}) AND ${OVERDUE}) AS project_overdue_tasks,
       (SELECT COUNT(*) FROM alerts a
          WHERE a.is_active = true AND a.resolved_at IS NULL
            AND a.project_id IN (${MY_PROJECTS}))                                        AS open_alerts`,
    [userId]
  );

  // Mes 5 prochaines échéances (tâches non terminées qui me sont assignées)
  const upcoming = await query(
    `SELECT t.id, t.title, t.due_date, t.due_estimated, t.priority, t.status,
            t.project_id, p.name AS project_name, t.meeting_id,
            (${OVERDUE}) AS overdue
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.is_active = true AND t.assignee_id = $1 AND t.status <> 'done' AND t.due_date IS NOT NULL
     ORDER BY t.due_date
     LIMIT 5`,
    [userId]
  );

  // COUNT(*) renvoie un bigint, que le pilote pg transmet en texte : conversion en nombre
  const row = counts.rows[0];
  const summary = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
  return { ...summary, upcoming_tasks: upcoming.rows };
};
