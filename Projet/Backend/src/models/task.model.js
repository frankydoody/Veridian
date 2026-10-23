// src/models/task.model.js
// Requêtes SQL pour la table tasks

import { query } from '../config/db.js';

// ─── Lire toutes les tâches d'un utilisateur ─────────────────────────────────
// Fait un JOIN sur projects pour avoir project_name
// et un JOIN sur meetings pour avoir meeting_title
export async function findAllTasks(userId) {
  const result = await query(
    `SELECT
       t.id,
       t.title,
       t.description,
       t.assignee,
       t.priority,
       t.status,
       t.due_date,
       t.created_at,
       t.updated_at,
       p.name  AS project_name,
       m.title AS meeting_title
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id
     LEFT JOIN meetings m ON t.meeting_id = m.id
     WHERE t.user_id = $1
     ORDER BY
       CASE t.priority
         WHEN 'haute'   THEN 1
         WHEN 'moyenne' THEN 2
         WHEN 'basse'   THEN 3
       END,
       t.created_at DESC`,
    [userId]
  );
  return result.rows;
}

// ─── Créer une tâche ─────────────────────────────────────────────────────────
export async function createTask({ title, description, assignee, priority, status, meeting_id, project_id, due_date, user_id }) {
  const result = await query(
    `INSERT INTO tasks (title, description, assignee, priority, status, meeting_id, project_id, due_date, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [title, description || null, assignee || null, priority || 'moyenne', status || 'todo', meeting_id || null, project_id || null, due_date || null, user_id]
  );
  return result.rows[0];
}

// ─── Mettre à jour le statut d'une tâche ─────────────────────────────────────
export async function updateTaskStatus(id, status, userId) {
  const result = await query(
    `UPDATE tasks
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [status, id, userId]
  );
  return result.rows[0];
}

// ─── Supprimer une tâche ──────────────────────────────────────────────────────
export async function deleteTask(id, userId) {
  await query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
}


// ─── Tâches d'un projet (toutes, quel que soit le créateur) ──────────────────
// L'appartenance au projet est vérifiée par l'appelant. Sert à l'export PDF.
export async function findTasksByProject(projectId) {
  const result = await query(
    `SELECT t.id, t.title, t.description, t.assignee, t.priority, t.status,
            t.due_date, t.created_at, m.title AS meeting_title
     FROM tasks t
     LEFT JOIN meetings m ON t.meeting_id = m.id
     WHERE t.project_id = $1
     ORDER BY
       CASE t.status WHEN 'done' THEN 2 ELSE 1 END,
       CASE t.priority WHEN 'haute' THEN 1 WHEN 'moyenne' THEN 2 ELSE 3 END,
       t.created_at DESC`,
    [projectId]
  );
  return result.rows;
}
