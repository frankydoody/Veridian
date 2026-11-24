// src/models/task.model.js
// Requêtes SQL pour la table tasks.
// Bloc 13 : suppression logique (is_active, migration 011), modification d'une tâche,
// acteur (assignee_id) choisi parmi les membres du projet.

import { query } from '../config/db.js';

// Colonnes renvoyées au frontend (jamais de donnée d'un autre utilisateur que son nom)
const TASK_COLUMNS = `
       t.id,
       t.title,
       t.description,
       COALESCE(au.name, t.assignee) AS assignee,
       t.assignee_id,
       t.priority,
       t.status,
       t.due_date,
       t.due_estimated,
       t.source,
       t.project_id,
       t.meeting_id,
       t.user_id,
       t.created_at,
       t.updated_at,
       p.name  AS project_name,
       m.title AS meeting_title`;

const TASK_JOINS = `
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id
     LEFT JOIN meetings m ON t.meeting_id = m.id
     LEFT JOIN users au ON au.id = t.assignee_id`;

// Une tâche est visible par son créateur, la personne assignée et les membres actifs de son projet
const VISIBLE_TO_USER = `
       (t.user_id = $1
        OR t.assignee_id = $1
        OR t.project_id IN (
             SELECT pm.project_id FROM project_members pm
             WHERE pm.user_id = $1 AND pm.is_active = true))`;

// ─── Lire toutes les tâches visibles par un utilisateur ──────────────────────
export async function findAllTasks(userId) {
  const result = await query(
    `SELECT ${TASK_COLUMNS}
     ${TASK_JOINS}
     WHERE t.is_active = true
       AND ${VISIBLE_TO_USER}
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

// ─── Une tâche, seulement si l'utilisateur peut la voir ──────────────────────
export async function findTaskForUser(id, userId) {
  const result = await query(
    `SELECT ${TASK_COLUMNS}, p.owner_id AS project_owner_id
     ${TASK_JOINS}
     WHERE t.id = $2
       AND t.is_active = true
       AND ${VISIBLE_TO_USER}`,
    [userId, id]
  );
  return result.rows[0];
}

// ─── Créer une tâche (manuelle) ──────────────────────────────────────────────
export async function createTask({ title, description, assignee_id, priority, status, meeting_id, project_id, due_date, user_id }) {
  const result = await query(
    `INSERT INTO tasks (title, description, assignee_id, priority, status, meeting_id, project_id,
                        due_date, due_estimated, source, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 'manual', $9)
     RETURNING id`,
    [title, description || null, assignee_id || null, priority || 'moyenne', status || 'todo',
     meeting_id || null, project_id || null, due_date || null, user_id]
  );
  return result.rows[0];
}

// Colonnes modifiables par PUT /api/tasks/:id (liste fixe : jamais un nom venant de la requête)
const UPDATABLE = ['title', 'description', 'priority', 'status', 'assignee_id', 'due_date'];

/**
 * Modifie seulement les champs présents dans `fields`.
 * - choisir (ou retirer) l'acteur efface l'ancien nom libre `assignee` (texte de l'IA),
 *   pour que l'affichage corresponde à l'acteur choisi ;
 * - fixer une date à la main retire la marque « date estimée ».
 * L'accès a été vérifié par l'appelant (findTaskForUser).
 */
export async function updateTask(id, fields) {
  const sets = [];
  const values = [];
  for (const column of UPDATABLE) {
    if (!Object.prototype.hasOwnProperty.call(fields, column)) continue;
    values.push(fields[column]);
    sets.push(`${column} = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'assignee_id')) sets.push('assignee = NULL');
  if (Object.prototype.hasOwnProperty.call(fields, 'due_date')) sets.push('due_estimated = false');
  if (sets.length === 0) return null;

  values.push(id);
  const result = await query(
    `UPDATE tasks
     SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length} AND is_active = true
     RETURNING id`,
    values
  );
  return result.rows[0];
}

// ─── Mettre à jour le statut d'une tâche ─────────────────────────────────────
export async function updateTaskStatus(id, status, userId) {
  const result = await query(
    `UPDATE tasks t
     SET status = $2, updated_at = NOW()
     WHERE t.id = $3
       AND t.is_active = true
       AND ${VISIBLE_TO_USER}
     RETURNING id`,
    [userId, status, id]
  );
  return result.rows[0];
}

// ─── Supprimer une tâche (suppression logique) ───────────────────────────────
// Réservé au créateur de la tâche ou au propriétaire de son projet.
export async function deactivateTask(id, userId) {
  const result = await query(
    `UPDATE tasks t
     SET is_active = false, updated_at = NOW()
     WHERE t.id = $1
       AND t.is_active = true
       AND (t.user_id = $2
            OR t.project_id IN (SELECT p.id FROM projects p WHERE p.owner_id = $2))
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
}

// ─── Tâches d'un projet (toutes, quel que soit le créateur) ──────────────────
// L'appartenance au projet est vérifiée par l'appelant. Sert à l'export PDF.
export async function findTasksByProject(projectId) {
  const result = await query(
    `SELECT t.id, t.title, t.description, COALESCE((SELECT u.name FROM users u WHERE u.id = t.assignee_id), t.assignee) AS assignee, t.priority, t.status,
            t.due_date, t.created_at, m.title AS meeting_title
     FROM tasks t
     LEFT JOIN meetings m ON t.meeting_id = m.id
     WHERE t.project_id = $1 AND t.is_active = true
     ORDER BY
       CASE t.status WHEN 'done' THEN 2 ELSE 1 END,
       CASE t.priority WHEN 'haute' THEN 1 WHEN 'moyenne' THEN 2 ELSE 3 END,
       t.created_at DESC`,
    [projectId]
  );
  return result.rows;
}
