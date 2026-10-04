// src/services/memory.service.js
import { embedText } from '../config/gemini.js';
import { splitIntoChunks } from '../utils/chunk.utils.js';
import {
  createMemoryChunks,
  replaceMemoryChunks,
  searchSimilarChunks,
} from '../models/memory.model.js';

const SEARCH_LIMIT = 6;      // nombre maximal d'extraits envoyés au LLM
const MIN_SIMILARITY = 0.5;  // similarité cosinus minimale pour garder un extrait

// ─── Indexation des transcriptions ───────────────────────────────────────────

/**
 * Indexe la transcription d'une réunion dans la mémoire vectorielle.
 * Les embeddings sont tous générés AVANT d'écrire en base : si l'API échoue
 * en cours de route, l'ancienne mémoire de la réunion reste intacte.
 *
 * @returns {{ stored: number }}
 */
export const indexTranscription = async (meetingId, projectId, rawText) => {
  const pieces = splitIntoChunks(rawText);
  const chunks = [];

  for (let i = 0; i < pieces.length; i++) {
    const embedding = await embedText(pieces[i].text, 'RETRIEVAL_DOCUMENT');

    chunks.push({
      chunkText: pieces[i].text,
      chunkType: 'transcription',
      embedding,
      metadata: {
        chunkIndex: i,
        totalChunks: pieces.length,
        charStart: pieces[i].charStart,
      },
    });
  }

  const stored = await replaceMemoryChunks(meetingId, projectId, 'transcription', chunks);
  return { stored: stored.length };
};

/**
 * Variante qui ne lance jamais d'erreur : l'indexation ne doit pas faire
 * échouer la transcription elle-même. En cas d'échec, on peut relancer
 * avec POST /api/memory/index/:meetingId.
 */
export const indexTranscriptionSafely = async (meetingId, projectId, rawText) => {
  try {
    const { stored } = await indexTranscription(meetingId, projectId, rawText);
    return { indexed: true, stored };
  } catch (error) {
    console.error('[Memory] Indexation de la transcription échouée :', error.message);
    return { indexed: false, stored: 0 };
  }
};

// ─── Indexation des décisions ────────────────────────────────────────────────

const buildDecisionText = (decision) => {
  return [
    decision.content,
    decision.context ? `Contexte : ${decision.context}` : '',
    decision.responsible ? `Responsable : ${decision.responsible}` : '',
  ].filter(Boolean).join('\n');
};

/**
 * Indexe des décisions (lignes de la table decisions) comme chunks de type 'decision'.
 * @returns {{ stored: number }}
 */
export const indexDecisions = async (meetingId, projectId, decisions) => {
  const chunks = [];

  for (const decision of decisions) {
    const chunkText = buildDecisionText(decision);
    const embedding = await embedText(chunkText, 'RETRIEVAL_DOCUMENT');

    chunks.push({
      chunkText,
      chunkType: 'decision',
      embedding,
      metadata: { decisionId: decision.id },
    });
  }

  const stored = await createMemoryChunks(meetingId, projectId, chunks);
  return { stored: stored.length };
};

export const indexDecisionsSafely = async (meetingId, projectId, decisions) => {
  try {
    const { stored } = await indexDecisions(meetingId, projectId, decisions);
    return { indexed: true, stored };
  } catch (error) {
    console.error('[Memory] Indexation des décisions échouée :', error.message);
    return { indexed: false, stored: 0 };
  }
};

// ─── Recherche (partie « Retrieval » du RAG) ─────────────────────────────────

/**
 * Trouve les extraits les plus pertinents pour une question.
 * @param {string} question
 * @param {{ projectId?: string, meetingId?: string }} scope
 * @returns {Array} chunks triés par similarité décroissante
 */
export const retrieveChunks = async (question, { projectId = null, meetingId = null } = {}) => {
  const queryEmbedding = await embedText(question, 'RETRIEVAL_QUERY');

  return searchSimilarChunks(queryEmbedding, {
    projectId,
    meetingId,
    limit: SEARCH_LIMIT,
    threshold: MIN_SIMILARITY,
  });
};
