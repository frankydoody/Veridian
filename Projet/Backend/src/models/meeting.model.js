import { query, withTransaction } from '../config/db.js';

const createMeeting = async (client, projectId, title, description) => {
  const result = await client.query(
    `INSERT INTO meetings (project_id, title, description)
     VALUES ($1, $2, $3)
     RETURNING id, project_id, title, description, status, is_active, created_at`,
    [projectId, title, description]
  );
  return result.rows[0];
};

const addMeetingParticipant = async (client, meetingId, userId, role = 'host') => {
  await client.query(
    `INSERT INTO participants (meeting_id, user_id, display_name, role)
     SELECT $1, $2, name, $3
     FROM users
     WHERE id = $2`,
    [meetingId, userId, role]
  );
};

export const createMeetingWithHost = async (projectId, title, description, userId) => {
  return withTransaction(async (client) => {
    const meeting = await createMeeting(client, projectId, title, description);
    await addMeetingParticipant(client, meeting.id, userId, 'host');
    return meeting;
  });
};

export const findMeetingsByProject = async (projectId, userId) => {
  const result = await query(
    `SELECT m.id, m.project_id, m.title, m.description,
            m.status, m.is_active, m.audio_path,
            m.started_at, m.ended_at, m.created_at
     FROM meetings m
     INNER JOIN project_members pm ON m.project_id = pm.project_id
     WHERE m.project_id = $1
     AND pm.user_id = $2
     AND pm.is_active = true
     AND m.is_active = true
     ORDER BY m.created_at DESC`,
    [projectId, userId]
  );
  return result.rows;
};


export const findMeetingById = async (id, userId) => {
  const result = await query(
    `SELECT m.id, m.project_id, m.title, m.description,
            m.status, m.is_active, m.audio_path,
            m.started_at, m.ended_at, m.created_at
     FROM meetings m
     INNER JOIN project_members pm ON m.project_id = pm.project_id
     WHERE m.id = $1
     AND pm.user_id = $2
     AND pm.is_active = true
     AND m.is_active = true`,
    [id, userId]
  );
  return result.rows[0];
};

export const updateMeetingStatus = async (id, status) => {
  const result = await query(
    `UPDATE meetings
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, project_id, title, status, updated_at`,
    [status, id]
  );
  return result.rows[0];
};




