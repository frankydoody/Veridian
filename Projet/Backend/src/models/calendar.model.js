// src/models/calendar.model.js
// Bloc 16 — Événements du calendrier : réunions et échéances de tâches dans une plage de jours.
//
// Contrôle d'accès DANS la requête : seules les réunions des projets dont l'utilisateur est
// membre actif, et seules les tâches qu'il peut voir (même règle que task.model.js).
//
// Fuseaux horaires :
//  - une échéance de tâche est un JOUR (fixée à 17 h UTC, voir BUG-03) : on filtre sur le jour UTC ;
//  - une réunion est un INSTANT : le frontend la place dans le jour LOCAL de l'utilisateur.
//    Le serveur ne connaît pas ce fuseau, il élargit donc la plage d'un jour de chaque côté ;
//    le frontend ne garde que les réunions qui tombent dans sa grille.
import { query } from '../config/db.js';

// Date affichée d'une réunion : prévue, sinon début réel, sinon création
const MEETING_DATE = 'COALESCE(m.scheduled_at, m.started_at, m.created_at)';

export const findCalendarMeetings = async ({ userId, from, to, projectId = null }) => {
  const result = await query(
    `SELECT m.id, m.title, m.status, m.project_id, p.name AS project_name,
            m.scheduled_at, m.transcription_status, m.analysis_status,
            ${MEETING_DATE} AS starts_at
     FROM meetings m
     INNER JOIN projects p ON p.id = m.project_id AND p.is_active = true
     INNER JOIN project_members pm ON pm.project_id = m.project_id
       AND pm.user_id = $1 AND pm.is_active = true
     WHERE m.is_active = true
       AND ($4::uuid IS NULL OR m.project_id = $4::uuid)
       AND ${MEETING_DATE} >= ($2::date - 1)
       AND ${MEETING_DATE} <  ($3::date + 2)
     ORDER BY starts_at`,
    [userId, from, to, projectId]
  );
  return result.rows;
};

export const findCalendarTasks = async ({ userId, from, to, projectId = null }) => {
  const result = await query(
    `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.due_estimated,
            t.project_id, p.name AS project_name, t.meeting_id,
            t.assignee_id, COALESCE(au.name, t.assignee) AS assignee
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN users au ON au.id = t.assignee_id
     WHERE t.is_active = true
       AND t.due_date IS NOT NULL
       AND (t.user_id = $1
            OR t.assignee_id = $1
            OR t.project_id IN (
                 SELECT pm.project_id FROM project_members pm
                 WHERE pm.user_id = $1 AND pm.is_active = true))
       AND ($4::uuid IS NULL OR t.project_id = $4::uuid)
       AND (t.due_date AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
     ORDER BY t.due_date, t.title`,
    [userId, from, to, projectId]
  );
  return result.rows;
};
