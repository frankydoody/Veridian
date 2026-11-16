// src/models/pipeline.model.js
// Bloc 19 — Accès base de données du pipeline d'analyse d'une réunion
import { query, withTransaction } from '../config/db.js';

// Personnes que l'utilisateur côtoie (membres de ses projets, lui compris)
export const findKnownUsers = async (userId) => {
  const result = await query(
    `SELECT DISTINCT u.id, u.name, u.email
     FROM users u
     INNER JOIN project_members pm2 ON pm2.user_id = u.id AND pm2.is_active = true
     INNER JOIN project_members pm1 ON pm1.project_id = pm2.project_id
                                    AND pm1.user_id = $1 AND pm1.is_active = true
     WHERE u.is_active = true
     ORDER BY u.name`,
    [userId]
  );
  return result.rows;
};

export const setAnalysisStatus = async (meetingId, status, error = null) => {
  await query(
    `UPDATE meetings
     SET analysis_status = $2::varchar,
         analysis_error  = $3,
         analyzed_at     = CASE WHEN $2::text = 'done' THEN NOW() ELSE analyzed_at END,
         updated_at      = NOW()
     WHERE id = $1`,
    [meetingId, status, error]
  );
};

// Historique d'un projet AVANT la réunion en cours (pour détecter les problèmes)
export const findProjectHistory = async (projectId, excludeMeetingId) => {
  const decisions = await query(
    `SELECT content FROM decisions
     WHERE project_id = $1 AND meeting_id <> $2 AND is_active = true
     ORDER BY created_at DESC LIMIT 30`,
    [projectId, excludeMeetingId]
  );
  const tasks = await query(
    `SELECT t.title, t.due_date, COALESCE(u.name, t.assignee) AS assignee
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.project_id = $1 AND t.status <> 'done' AND t.is_active = true
       AND (t.meeting_id IS NULL OR t.meeting_id <> $2)
     ORDER BY t.due_date NULLS LAST LIMIT 30`,
    [projectId, excludeMeetingId]
  );
  return { decisions: decisions.rows, openTasks: tasks.rows };
};

/**
 * Enregistre le résultat de l'analyse en UNE transaction :
 * tout est enregistré ou rien. Relancer l'analyse remplace le résultat précédent
 * (les tâches créées à la main ne sont jamais touchées).
 *
 * @param normalized résultat de normalizeAnalysis
 * @returns { projects, decisions, tasks } avec les identifiants créés
 */
export const persistAnalysis = async (meeting, userId, normalized) => {
  return withTransaction(async (client) => {
    // 1. Nettoyage d'une éventuelle analyse précédente de cette réunion
    await client.query(`DELETE FROM tasks WHERE meeting_id = $1 AND source = 'ai'`, [meeting.id]);
    await client.query(`DELETE FROM mtg_risks WHERE meeting_id = $1`, [meeting.id]);
    await client.query(
      `UPDATE decisions SET is_active = false, updated_at = NOW()
       WHERE meeting_id = $1 AND is_active = true`,
      [meeting.id]
    );

    // 2. Projets : les existants sont réutilisés, les nouveaux sont créés
    const projects = [];
    const idByKey = new Map();
    for (const ref of normalized.projects) {
      if (ref.existing) {
        idByKey.set(ref.key, ref.existing.id);
        projects.push({ id: ref.existing.id, name: ref.name, isNew: false });
        continue;
      }
      const created = await client.query(
        `INSERT INTO projects (name, description, owner_id)
         VALUES ($1, $2, $3) RETURNING id, name`,
        [ref.name, ref.description || 'Projet créé automatiquement à partir d\'une réunion.', userId]
      );
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [created.rows[0].id, userId]
      );
      idByKey.set(ref.key, created.rows[0].id);
      projects.push({ id: created.rows[0].id, name: created.rows[0].name, isNew: true });
    }
    const newProjectIds = new Set(projects.filter((p) => p.isNew).map((p) => p.id));

    // 3. Décisions
    const decisions = [];
    for (const d of normalized.decisions) {
      const projectId = idByKey.get(d.projectKey);
      const r = await client.query(
        `INSERT INTO decisions (meeting_id, project_id, content, context, responsible, alternatives, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, meeting_id, project_id, content, context, responsible, alternatives, confidence, status, created_at`,
        [meeting.id, projectId, d.content, d.context, d.responsible, d.alternatives, d.confidence]
      );
      decisions.push(r.rows[0]);
    }

    // 4. Tâches : un acteur n'est lié que s'il est (ou devient, pour un projet NOUVEAU) membre
    const tasks = [];
    for (const t of normalized.tasks) {
      const projectId = idByKey.get(t.projectKey);
      let assigneeId = t.assigneeId;

      if (assigneeId) {
        if (newProjectIds.has(projectId)) {
          await client.query(
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (user_id, project_id) DO UPDATE SET is_active = true`,
            [projectId, assigneeId]
          );
        } else {
          const member = await client.query(
            `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
            [projectId, assigneeId]
          );
          if (member.rowCount === 0) assigneeId = null; // jamais d'accès ajouté à un projet existant
        }
      }

      const r = await client.query(
        `INSERT INTO tasks (title, description, assignee, assignee_id, priority, status,
                            meeting_id, project_id, due_date, due_estimated, source, user_id)
         VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, $9, 'ai', $10)
         RETURNING id, title, description, assignee, assignee_id, priority, status,
                   project_id, meeting_id, due_date, due_estimated`,
        [t.title, t.description, t.assigneeName, assigneeId, t.priority,
         meeting.id, projectId, t.dueDate, t.dueEstimated, userId]
      );
      tasks.push({ ...r.rows[0], assignee_email: assigneeId ? t.assigneeEmail : null });
    }

    await client.query(
      `UPDATE meetings SET status = 'done', updated_at = NOW() WHERE id = $1`,
      [meeting.id]
    );

    return { projects, decisions, tasks };
  });
};

export const saveRisks = async (projectId, meetingId, risks) => {
  const saved = [];
  for (const r of risks) {
    const result = await query(
      `INSERT INTO mtg_risks (project_id, meeting_id, kind, description, severity, mitigation)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, project_id, meeting_id, kind, description, severity, mitigation, created_at`,
      [projectId, meetingId, r.kind, r.description, r.severity, r.mitigation]
    );
    saved.push(result.rows[0]);
  }
  return saved;
};

export const saveNotification = async ({ meetingId, userId, email, subject, kind, status, error }) => {
  const result = await query(
    `INSERT INTO mtg_notifications (meeting_id, user_id, email, subject, kind, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, subject, kind, status, error, created_at`,
    [meetingId, userId || null, email, subject, kind, status, error || null]
  );
  return result.rows[0];
};

// Résultat complet d'une analyse (pour l'écran de la réunion)
export const findAnalysisByMeeting = async (meetingId) => {
  const decisions = await query(
    `SELECT d.id, d.project_id, p.name AS project_name, d.content, d.context,
            d.responsible, d.alternatives, d.confidence, d.status
     FROM decisions d INNER JOIN projects p ON p.id = d.project_id
     WHERE d.meeting_id = $1 AND d.is_active = true ORDER BY d.created_at`,
    [meetingId]
  );
  const tasks = await query(
    `SELECT t.id, t.title, t.description, t.priority, t.status, t.due_date, t.due_estimated,
            t.project_id, p.name AS project_name, t.assignee_id,
            COALESCE(u.name, t.assignee) AS assignee_name, u.email AS assignee_email
     FROM tasks t
     INNER JOIN projects p ON p.id = t.project_id
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.meeting_id = $1 AND t.source = 'ai' AND t.is_active = true
     ORDER BY t.due_date NULLS LAST, t.created_at`,
    [meetingId]
  );
  const risks = await query(
    `SELECT r.id, r.project_id, p.name AS project_name, r.kind, r.description, r.severity, r.mitigation
     FROM mtg_risks r INNER JOIN projects p ON p.id = r.project_id
     WHERE r.meeting_id = $1 ORDER BY r.created_at`,
    [meetingId]
  );
  const notifications = await query(
    `SELECT id, email, subject, kind, status, error, created_at
     FROM mtg_notifications WHERE meeting_id = $1 ORDER BY created_at`,
    [meetingId]
  );
  return {
    decisions: decisions.rows,
    tasks: tasks.rows,
    risks: risks.rows,
    notifications: notifications.rows,
  };
};
