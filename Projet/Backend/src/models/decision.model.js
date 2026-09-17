import { query, withTransaction } from '../config/db.js';


const insertDecision = async (client, meetingId, projectId, decision) => {
  const result = await client.query(
    `INSERT INTO decisions 
      (meeting_id, project_id, content, context, responsible, alternatives, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, meeting_id, project_id, content, context, 
               responsible, alternatives, confidence, status, created_at`,
    [
      meetingId,
      projectId,
      decision.content,
      decision.context || null,
      decision.responsible || null,
      decision.alternatives || [],
      decision.confidence || 100,
    ]
  );
  return result.rows[0];
};

export const createDecisions = async (meetingId, projectId, decisions) => {
  return withTransaction(async (client) => {
    const created = [];

    for (const decision of decisions) {
      const newDecision = await insertDecision(client, meetingId, projectId, decision);
      created.push(newDecision);
    }

    await client.query(
      `UPDATE meetings 
       SET status = 'done', updated_at = NOW()
       WHERE id = $1`,
      [meetingId]
    );

    return created;
  });
};

export const findDecisionsByMeeting = async (meetingId) => {
  const result = await query(
    `SELECT id, meeting_id, project_id, content, context,
            responsible, alternatives, confidence, status, created_at
     FROM decisions
     WHERE meeting_id = $1
     AND is_active = true
     ORDER BY created_at ASC`,
    [meetingId]
  );
  return result.rows;
};

export const findDecisionsByProject = async (projectId) => {
  const result = await query(
    `SELECT d.id, d.meeting_id, d.project_id, d.content, d.context,
            d.responsible, d.alternatives, d.confidence, d.status,
            d.created_at, m.title as meeting_title
     FROM decisions d
     INNER JOIN meetings m ON d.meeting_id = m.id
     WHERE d.project_id = $1
     AND d.is_active = true
     ORDER BY d.created_at DESC`,
    [projectId]
  );
  return result.rows;
};




