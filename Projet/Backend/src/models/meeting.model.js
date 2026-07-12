import { query } from '../config/db.js';

export const createMeeting = async (projectId, title, description) => {
  const result = await query(
    `INSERT INTO meetings (project_id, title, description)
     VALUES ($1, $2, $3)
     RETURNING id, project_id, title, description, status, is_active, created_at`,
    [projectId, title, description]
  );
  return result.rows[0];
};