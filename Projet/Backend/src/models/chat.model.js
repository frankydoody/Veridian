// src/models/chat.model.js
// Historique du chat mémoire : conversations et messages.
// Toutes les lectures/écritures filtrent sur user_id : une conversation n'est
// jamais visible par un autre utilisateur, même membre du même projet.
import { query, withTransaction } from '../config/db.js';

const CONVERSATION_COLUMNS = 'id, project_id, user_id, title, created_at, updated_at';

export const createConversation = async (projectId, userId, title) => {
  const result = await query(
    `INSERT INTO mtg_chat_conversations (project_id, user_id, title)
     VALUES ($1, $2, COALESCE($3, 'Nouvelle conversation'))
     RETURNING ${CONVERSATION_COLUMNS}`,
    [projectId, userId, title || null]
  );
  return result.rows[0];
};

// Conversations de l'utilisateur dans un projet, la plus récemment active d'abord.
export const findConversationsByProject = async (projectId, userId) => {
  const result = await query(
    `SELECT c.id, c.project_id, c.title, c.created_at, c.updated_at,
            (SELECT COUNT(*)::int FROM mtg_chat_messages m
              WHERE m.conversation_id = c.id) AS message_count
     FROM mtg_chat_conversations c
     WHERE c.project_id = $1 AND c.user_id = $2 AND c.is_active = true
     ORDER BY c.updated_at DESC`,
    [projectId, userId]
  );
  return result.rows;
};

// Renvoie undefined si la conversation n'existe pas OU appartient à quelqu'un d'autre.
// Le projet doit aussi rester accessible (membre actif d'un projet actif).
export const findConversationById = async (id, userId) => {
  const result = await query(
    `SELECT c.id, c.project_id, c.user_id, c.title, c.created_at, c.updated_at
     FROM mtg_chat_conversations c
     INNER JOIN projects p ON p.id = c.project_id
     INNER JOIN project_members pm ON pm.project_id = c.project_id
     WHERE c.id = $1
       AND c.user_id = $2
       AND c.is_active = true
       AND p.is_active = true
       AND pm.user_id = $2
       AND pm.is_active = true`,
    [id, userId]
  );
  return result.rows[0];
};

export const findMessagesByConversation = async (conversationId) => {
  const result = await query(
    `SELECT id, role, content, sources, created_at
     FROM mtg_chat_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC, id ASC`,
    [conversationId]
  );
  return result.rows;
};

// Derniers messages (ordre chronologique) : sert de mémoire courte pour le LLM.
export const findRecentMessages = async (conversationId, limit = 6) => {
  const result = await query(
    `SELECT role, content FROM (
       SELECT role, content, created_at, id
       FROM mtg_chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2
     ) recent
     ORDER BY created_at ASC, id ASC`,
    [conversationId, limit]
  );
  return result.rows;
};

// Enregistre la question ET la réponse ensemble (transaction), met à jour la
// date d'activité et, au premier échange, donne un titre à la conversation.
export const addExchange = async (conversationId, { question, answer, sources }) => {
  return withTransaction(async (client) => {
    const userMsg = await client.query(
      `INSERT INTO mtg_chat_messages (conversation_id, role, content, created_at)
       VALUES ($1, 'user', $2, clock_timestamp())
       RETURNING id, role, content, sources, created_at`,
      [conversationId, question]
    );
    const assistantMsg = await client.query(
      `INSERT INTO mtg_chat_messages (conversation_id, role, content, sources, created_at)
       VALUES ($1, 'assistant', $2, $3, clock_timestamp())
       RETURNING id, role, content, sources, created_at`,
      [conversationId, answer, JSON.stringify(sources || [])]
    );
    await client.query(
      `UPDATE mtg_chat_conversations
       SET updated_at = NOW(),
           title = CASE WHEN title = 'Nouvelle conversation' THEN $2 ELSE title END
       WHERE id = $1`,
      [conversationId, question.slice(0, 80)]
    );
    return { userMessage: userMsg.rows[0], assistantMessage: assistantMsg.rows[0] };
  });
};

// Soft delete : l'historique est conservé en base, mais n'est plus accessible.
export const deactivateConversation = async (id, userId) => {
  const result = await query(
    `UPDATE mtg_chat_conversations
     SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND is_active = true
     RETURNING id`,
    [id, userId]
  );
  return result.rows[0];
};
