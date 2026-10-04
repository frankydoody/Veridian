// src/models/memory.model.js
import { query, withTransaction } from '../config/db.js';

// pgvector attend un vecteur sous forme de texte : '[0.1,0.2,...]'
const toVector = (embedding) => `[${embedding.join(',')}]`;

// ─── Fonctions SQL privées (composables dans une transaction) ────────────────

const insertChunk = async (client, meetingId, projectId, chunk) => {
  const result = await client.query(
    `INSERT INTO mtg_memory_chunks
       (meeting_id, project_id, chunk_text, chunk_type, embedding, metadata)
     VALUES ($1, $2, $3, $4, $5::vector, $6)
     RETURNING id, meeting_id, project_id, chunk_type, created_at`,
    [
      meetingId,
      projectId,
      chunk.chunkText,
      chunk.chunkType,
      toVector(chunk.embedding),
      JSON.stringify(chunk.metadata || {}),
    ]
  );
  return result.rows[0];
};

// Soft delete : on désactive, on ne supprime jamais
const deactivateChunks = async (client, meetingId, chunkType) => {
  await client.query(
    `UPDATE mtg_memory_chunks
     SET is_active = false
     WHERE meeting_id = $1
     AND chunk_type = $2
     AND is_active = true`,
    [meetingId, chunkType]
  );
};

// ─── Fonctions publiques ─────────────────────────────────────────────────────

/**
 * Ajoute des chunks à la mémoire d'une réunion.
 * @param {string} meetingId
 * @param {string} projectId
 * @param {{ chunkText: string, chunkType: string, embedding: number[], metadata?: Object }[]} chunks
 */
export const createMemoryChunks = async (meetingId, projectId, chunks) => {
  return withTransaction(async (client) => {
    const created = [];
    for (const chunk of chunks) {
      created.push(await insertChunk(client, meetingId, projectId, chunk));
    }
    return created;
  });
};

/**
 * Remplace les chunks actifs d'un type donné pour une réunion (ré-indexation).
 * Tout se fait dans une transaction : si une insertion échoue,
 * les anciens chunks restent actifs.
 */
export const replaceMemoryChunks = async (meetingId, projectId, chunkType, chunks) => {
  return withTransaction(async (client) => {
    await deactivateChunks(client, meetingId, chunkType);

    const created = [];
    for (const chunk of chunks) {
      created.push(await insertChunk(client, meetingId, projectId, chunk));
    }
    return created;
  });
};

/**
 * Recherche les chunks actifs les plus proches d'un vecteur de question.
 * `<=>` est la distance cosinus de pgvector (0 = identique) ;
 * `1 - distance` donne la similarité.
 *
 * @param {number[]} queryEmbedding
 * @param {{ projectId?: string, meetingId?: string, limit?: number, threshold?: number }} options
 */
export const searchSimilarChunks = async (queryEmbedding, {
  projectId = null,
  meetingId = null,
  limit = 5,
  threshold = 0.5,
} = {}) => {
  const conditions = ['c.is_active = true', 'm.is_active = true'];
  const params = [toVector(queryEmbedding), limit];
  let paramIdx = 3;

  if (projectId) {
    conditions.push(`c.project_id = $${paramIdx++}`);
    params.push(projectId);
  }
  if (meetingId) {
    conditions.push(`c.meeting_id = $${paramIdx++}`);
    params.push(meetingId);
  }

  const result = await query(
    `SELECT c.id, c.meeting_id, c.project_id, c.chunk_text, c.chunk_type,
            c.metadata, c.created_at, m.title AS meeting_title,
            1 - (c.embedding <=> $1::vector) AS similarity
     FROM mtg_memory_chunks c
     INNER JOIN meetings m ON m.id = c.meeting_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    params
  );

  return result.rows.filter((row) => row.similarity >= threshold);
};

/**
 * Liste les chunks actifs d'une réunion (sans le vecteur, trop volumineux).
 */
export const findChunksByMeeting = async (meetingId) => {
  const result = await query(
    `SELECT id, meeting_id, project_id, chunk_text, chunk_type, metadata, created_at
     FROM mtg_memory_chunks
     WHERE meeting_id = $1
     AND is_active = true
     ORDER BY chunk_type, created_at ASC`,
    [meetingId]
  );
  return result.rows;
};
