import { query } from '../config/db.js';

export const createProject = async (name, description, ownerId) => {
  const result = await query(
    `INSERT INTO projects (name, description, owner_id)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, owner_id, status, is_active, created_at`,
    [name, description, ownerId]
  );
  return result.rows[0];
};


export const findProjectsByUser = async (userId) => {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.owner_id, 
            p.status, p.is_active, p.created_at
     FROM projects p
     INNER JOIN project_members pm ON p.id = pm.project_id
     WHERE pm.user_id = $1
     AND pm.is_active = true
     AND p.is_active = true
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const findProjectById = async (id, userId) => {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.owner_id,
            p.status, p.is_active, p.created_at
     FROM projects p
     INNER JOIN project_members pm ON p.id = pm.project_id
     WHERE p.id = $1
     AND pm.user_id = $2
     AND pm.is_active = true
     AND p.is_active = true`,
    [id, userId]
  );
  return result.rows[0];
};

export const updateProject = async (id, name, description) => {
  const result = await query(
    `UPDATE projects
     SET name = $1, description = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, description, owner_id, status, is_active, updated_at`,
    [name, description, id]
  );
  return result.rows[0];
};


export const updateProjectStatus = async (id, status) => {
  const result = await query(
    `UPDATE projects
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, status, updated_at`,
    [status, id]
  );
  return result.rows[0];
};

export const addProjectMember = async (projectId, userId, role = 'member') => {
  const result = await query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING project_id, user_id, role, joined_at`,
    [projectId, userId, role]
  );
  return result.rows[0];
};
