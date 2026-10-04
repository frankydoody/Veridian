import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FALLBACK_MODELS = [
  process.env.AI_MODEL || 'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export const getGeminiModel = () => {
  return genAI.getGenerativeModel({
    model: FALLBACK_MODELS[0],
  });
};

export const generateWithFallback = async (prompt) => {
  let lastError;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      
      if (modelName !== FALLBACK_MODELS[0]) {
        console.log(`⚠️ Modèle de secours utilisé : ${modelName}`);
      }
      
      return result.response.text();
    } catch (error) {
      const isRetryable = 
        error.message?.includes('503') ||
        error.message?.includes('overloaded') ||
        error.message?.includes('high demand') ||
        error.message?.includes('404') ||
        error.message?.includes('not found');

      if (isRetryable) {
        console.log(`⚠️ Modèle ${modelName} indisponible, tentative suivante...`);
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Tous les modèles Gemini sont indisponibles. Dernière erreur: ${lastError.message}`);
};

// ─── Embeddings ──────────────────────────────────────────────────────────────

const EMBED_MODEL = process.env.EMBED_MODEL || 'gemini-embedding-001';
const EMBED_MAX_RETRIES = 3;

// Doit correspondre à la colonne embedding vector(768) de mtg_memory_chunks
export const EMBED_DIMENSIONS = 768;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Transforme un texte en vecteur (embedding) de EMBED_DIMENSIONS nombres.
 * @param {string} text
 * @param {string} taskType — RETRIEVAL_DOCUMENT (texte à indexer) | RETRIEVAL_QUERY (question)
 * @returns {Promise<number[]>}
 */
export const embedText = async (text, taskType = 'RETRIEVAL_DOCUMENT') => {
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });

  for (let attempt = 1; attempt <= EMBED_MAX_RETRIES; attempt++) {
    try {
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        taskType,
        outputDimensionality: EMBED_DIMENSIONS,
      });

      const values = result.embedding.values;

      if (values.length < EMBED_DIMENSIONS) {
        throw new Error(
          `Embedding de ${values.length} dimensions reçu, ${EMBED_DIMENSIONS} attendues (modèle ${EMBED_MODEL})`
        );
      }

      // Si le modèle renvoie plus de dimensions que demandé, on garde les premières :
      // les embeddings Gemini sont conçus pour rester valides une fois tronqués.
      return values.slice(0, EMBED_DIMENSIONS);

    } catch (error) {
      const isRetryable =
        error.message?.includes('429') ||
        error.message?.includes('503');

      if (!isRetryable || attempt === EMBED_MAX_RETRIES) throw error;

      // Limite de débit atteinte : on attend de plus en plus longtemps
      await wait(attempt * 2000);
    }
  }
};