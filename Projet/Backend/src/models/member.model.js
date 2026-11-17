// src/models/member.model.js
// Bloc 13 — Membres d'un projet (table project_members).
// Le contrôle d'accès (appartenance, propriétaire) est fait par le contrôleur AVANT ces appels.
// Aucune requête ne renvoie password_hash.
import { query } from '../config/db.js';

// Membres actifs d'un projet, propriétaire en premier
export const findProjectMembers = async (projectId) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, pm.role, pm.joined_at
     FROM project_members pm
     INNER JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
       AND pm.is_active = true
       AND u.is_active = true
     ORDER BY (pm.role = 'owner') DESC, u.name`,
    [projectId]
  );
  return result.rows;
};

// Compte actif correspondant EXACTEMENT à un courriel (pas de recherche partielle :
// on ne permet pas de parcourir la liste des utilisateurs).
export const findActiveUserByEmail = async (email) => {
  const result = await query(
    `SELECT id, name, email
     FROM users
     WHERE LOWER(email) = LOWER($1) AND is_active = true`,
    [email]
  );
  return result.rows[0];
};

export const isActiveMember = async (projectId, userId) => {
  const result = await query(
    `SELECT 1 FROM project_members
     WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
    [projectId, userId]
  );
  return result.rowCount > 0;
};

/**
 * Ajoute un membre, ou réactive un ancien membre retiré (suppression logique).
 * @returns la ligne ajoutée/réactivée, ou undefined si la personne était DÉJÀ membre active.
 */
export const addProjectMember = async (projectId, userId) => {
  const result = await query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (user_id, project_id)
       DO UPDATE SET is_active = true, joined_at = NOW()
       WHERE project_members.is_active = false
     RETURNING user_id, project_id, role, joined_at`,
    [projectId, userId]
  );
  return result.rows[0];
};

/**
 * Retire un membre (is_active = false). Le propriétaire ne peut jamais être retiré.
 * @returns true si un membre a été retiré
 */
export const deactivateProjectMember = async (projectId, userId) => {
  const result = await query(
    `UPDATE project_members
     SET is_active = false
     WHERE project_id = $1 AND user_id = $2
       AND is_active = true
       AND role <> 'owner'
     RETURNING user_id`,
    [projectId, userId]
  );
  return result.rowCount > 0;
};
