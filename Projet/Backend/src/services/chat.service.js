// src/services/chat.service.js
// Chat mémoire avec historique : une question → recherche vectorielle dans le
// projet → réponse du LLM → question et réponse enregistrées dans la conversation.
import { retrieveChunks } from './memory.service.js';
import { chatWithMemory } from './ia.service.js';
import { findRecentMessages, addExchange } from '../models/chat.model.js';

const HISTORY_LIMIT = 6; // derniers messages transmis au LLM (3 échanges)
const NO_CONTEXT_ANSWER = "Je n'ai trouvé aucune information à ce sujet dans l'historique du projet.";

// Une question de suivi (« et qui s'en occupe ? ») n'a pas de sens seule pour la
// recherche vectorielle : on y ajoute la dernière question de l'utilisateur.
export const buildSearchQuery = (question, history) => {
  const lastUserQuestion = [...history].reverse().find((m) => m.role === 'user');
  return lastUserQuestion ? `${lastUserQuestion.content}\n${question}` : question;
};

const toSources = (chunks) => chunks.map((c) => ({
  meetingId: c.meeting_id,
  meetingTitle: c.meeting_title,
  chunkType: c.chunk_type,
  similarity: Math.round(c.similarity * 100) / 100,
}));

/**
 * Pose une question dans une conversation existante (déjà vérifiée par le contrôleur).
 * Si l'IA échoue, rien n'est enregistré : l'utilisateur peut simplement réessayer.
 *
 * @returns {{ userMessage, assistantMessage, hasContext: boolean }}
 */
export const askInConversation = async (conversation, question) => {
  const history = await findRecentMessages(conversation.id, HISTORY_LIMIT);

  const chunks = await retrieveChunks(
    buildSearchQuery(question, history),
    { projectId: conversation.project_id }
  );

  const hasContext = chunks.length > 0;
  const answer = hasContext
    ? await chatWithMemory(question, chunks, history)
    : NO_CONTEXT_ANSWER;

  const { userMessage, assistantMessage } = await addExchange(conversation.id, {
    question,
    answer,
    sources: toSources(chunks),
  });

  return { userMessage, assistantMessage, hasContext };
};
