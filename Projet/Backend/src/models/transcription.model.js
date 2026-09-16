import { query, withTransaction } from '../config/db.js';


const insertTranscription = async (client, meetingId, rawText, language = 'fr') => {
  const result = await client.query(
    `INSERT INTO transcriptions (meeting_id, raw_text, language)
     VALUES ($1, $2, $3)
     RETURNING id, meeting_id, raw_text, language, is_edited, created_at`,
    [meetingId, rawText, language]
  );
  return result.rows[0];
};


export const createTranscription = async (meetingId, rawText, language = 'fr') => {
  return withTransaction(async (client) => {
    const transcription = await insertTranscription(client, meetingId, rawText, language);

    await client.query(
      `UPDATE meetings
       SET status = 'processing', updated_at = NOW()
       WHERE id = $1`,
      [meetingId]
    );

    return transcription;
  });
};

export const findTranscriptionByMeeting = async (meetingId) => {
  const result = await query(
    `SELECT id, meeting_id, raw_text, language, is_edited, created_at, updated_at
     FROM transcriptions
     WHERE meeting_id = $1
     AND is_active = true`,
    [meetingId]
  );
  return result.rows[0];
};

export const updateTranscriptionText = async (id, rawText) => {
  const result = await query(
    `UPDATE transcriptions
     SET raw_text = $1, is_edited = true, updated_at = NOW()
     WHERE id = $2
     RETURNING id, meeting_id, raw_text, language, is_edited, updated_at`,
    [rawText, id]
  );
  return result.rows[0];
};