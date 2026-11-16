// src/models/meeting-detail.model.js
// Bloc 14 — Tout ce que la page de détail d'une réunion affiche, en un seul appel.
// L'appartenance au projet est vérifiée par le contrôleur AVANT (findMeetingById).
import { query } from '../config/db.js';

export const setMeetingAudio = async (meetingId, fileName) => {
  const result = await query(
    `UPDATE meetings
     SET audio_path = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, audio_path`,
    [meetingId, fileName]
  );
  return result.rows[0];
};

export const findMeetingDetails = async (meetingId, userId) => {
  const [transcription, decisions, tasks, alerts, risks, notifications, projects] = await Promise.all([
    query(
      `SELECT id, raw_text, language, is_edited, created_at, updated_at
       FROM transcriptions
       WHERE meeting_id = $1 AND is_active = true`,
      [meetingId]
    ),
    query(
      `SELECT d.id, d.project_id, p.name AS project_name, d.content, d.context, d.responsible,
              d.alternatives, d.confidence, d.status, d.created_at
       FROM decisions d
       INNER JOIN projects p ON p.id = d.project_id
       WHERE d.meeting_id = $1 AND d.is_active = true
       ORDER BY d.created_at`,
      [meetingId]
    ),
    // Toutes les tâches de la réunion : extraites par l'analyse ET créées à la main
    query(
      `SELECT t.id, t.title, t.description, t.priority, t.status, t.due_date, t.due_estimated,
              t.source, t.project_id, p.name AS project_name, t.meeting_id, t.user_id,
              t.assignee_id, COALESCE(u.name, t.assignee) AS assignee
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.meeting_id = $1 AND t.is_active = true
       ORDER BY t.due_date NULLS LAST, t.created_at`,
      [meetingId]
    ),
    // Contradictions où une décision de CETTE réunion est en cause (nouvelle ou contredite)
    query(
      `SELECT a.id, a.explanation, a.severity, a.resolved_at, a.created_at,
              nd.content AS new_decision, cd.content AS conflict_decision,
              nd.meeting_id AS new_meeting_id, cd.meeting_id AS conflict_meeting_id,
              cm.title AS conflict_meeting_title
       FROM alerts a
       INNER JOIN decisions nd ON nd.id = a.new_decision_id
       INNER JOIN decisions cd ON cd.id = a.conflict_decision_id
       INNER JOIN meetings cm ON cm.id = cd.meeting_id
       WHERE a.is_active = true
         AND (nd.meeting_id = $1 OR cd.meeting_id = $1)
       ORDER BY a.created_at DESC`,
      [meetingId]
    ),
    query(
      `SELECT r.id, r.project_id, p.name AS project_name, r.kind, r.description, r.severity,
              r.mitigation, r.created_at
       FROM mtg_risks r
       INNER JOIN projects p ON p.id = r.project_id
       WHERE r.meeting_id = $1
       ORDER BY CASE r.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, r.created_at`,
      [meetingId]
    ),
    query(
      `SELECT id, email, subject, kind, status, error, created_at
       FROM mtg_notifications
       WHERE meeting_id = $1
       ORDER BY created_at`,
      [meetingId]
    ),
    // Bloc 21 : projets concernés (celui de la réunion + ceux de ses décisions et tâches),
    // « nouveau » s'il a été créé par l'analyse de CETTE réunion. Seulement les projets
    // dont l'utilisateur est membre : on ne révèle pas le nom d'un projet inaccessible.
    query(
      // COALESCE : NULL = $1 vaut NULL (et non false) pour un projet qui n'a pas de réunion source
      `SELECT p.id, p.name, COALESCE(p.source_meeting_id = $1, false) AS is_new
       FROM projects p
       INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2 AND pm.is_active = true
       WHERE p.is_active = true
         AND p.id IN (
           SELECT project_id FROM meetings WHERE id = $1
           UNION SELECT project_id FROM decisions WHERE meeting_id = $1 AND is_active = true
           UNION SELECT project_id FROM tasks WHERE meeting_id = $1 AND is_active = true)
       ORDER BY is_new DESC, p.name`,
      [meetingId, userId]
    ),
  ]);

  return {
    transcription: transcription.rows[0] ?? null,
    decisions: decisions.rows,
    tasks: tasks.rows,
    alerts: alerts.rows,
    risks: risks.rows,
    notifications: notifications.rows,
    projects: projects.rows,
  };
};
