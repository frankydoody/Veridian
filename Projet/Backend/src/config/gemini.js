import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Modèle principal par défaut. Google retire régulièrement des modèles, et certains sont
// fermés aux NOUVEAUX comptes avant d'être retirés (cas de gemini-2.5-flash, voir BUG-40).
export const DEFAULT_MODEL = 'gemini-3.5-flash';

// Modèles de secours : des alias « -latest » que Google fait pointer vers un modèle courant.
// Ils survivent aux retraits de versions, contrairement à un numéro de version figé.
const SECOURS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

/** Modèles essayés dans l'ordre : AI_MODEL (ou le défaut), puis les secours, sans doublon. */
export const fallbackModels = (primary = process.env.AI_MODEL) =>
  [...new Set([primary || DEFAULT_MODEL, ...SECOURS])];

const KEY_HELP = 'vérifiez GEMINI_API_KEY dans Projet/Backend/.env (clé gratuite : https://aistudio.google.com/apikey), puis redémarrez le backend';

/** Erreur Gemini expliquée en français ; `cause` garde le message brut de Google (console). */
export class GeminiError extends Error {
  constructor(message, { kind, cause } = {}) {
    super(message, { cause });
    this.name = 'GeminiError';
    this.kind = kind;
  }
}

/**
 * Classe une erreur renvoyée par l'API Gemini.
 *  key   : clé absente, invalide, expirée ou refusée → inutile d'essayer un autre modèle
 *  model : modèle inexistant, retiré ou fermé aux nouveaux comptes (404) → modèle suivant
 *  busy  : surcharge ou quota atteint (503, 500, 429) → modèle suivant
 *  other : autre erreur (requête refusée, réseau…) → transmise telle quelle
 */
export const classifyGeminiError = (error) => {
  const msg = String(error?.message ?? '');
  if (/API_KEY_INVALID|API key not valid|API key expired|PERMISSION_DENIED|\[403 /i.test(msg)) return 'key';
  if (/\[404 |not found|no longer available/i.test(msg)) return 'model';
  if (/\[503 |\[500 |\[429 |overloaded|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'busy';
  return 'other';
};

const missingKey = () => new GeminiError(`Clé Gemini absente : ${KEY_HELP}.`, { kind: 'key' });
const refusedKey = (cause) => new GeminiError(`Clé Gemini refusée par Google : ${KEY_HELP}.`, { kind: 'key', cause });

export const getGeminiModel = () => {
  return genAI.getGenerativeModel({
    model: fallbackModels()[0],
  });
};

export const generateWithFallback = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) throw missingKey();

  const models = fallbackModels();
  const failures = [];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);

      if (modelName !== models[0]) {
        console.log(`⚠️ Modèle de secours utilisé : ${modelName}`);
      }

      return result.response.text();
    } catch (error) {
      const kind = classifyGeminiError(error);
      // Une clé refusée l'est pour tous les modèles : on s'arrête tout de suite
      if (kind === 'key') throw refusedKey(error);
      if (kind === 'other') throw error;

      console.log(`⚠️ Modèle ${modelName} indisponible (${error.message.slice(0, 160)}), tentative suivante...`);
      failures.push({ modelName, kind, error });
    }
  }

  const tried = failures.map((f) => f.modelName).join(', ');
  const cause = failures.at(-1)?.error;
  if (failures.every((f) => f.kind === 'model')) {
    throw new GeminiError(
      `Aucun modèle Gemini disponible pour ce compte (essayés : ${tried}). `
      + `Indiquez un modèle disponible dans AI_MODEL (Projet/Backend/.env), par exemple ${DEFAULT_MODEL}.`,
      { kind: 'model', cause }
    );
  }
  throw new GeminiError(
    `Les modèles Gemini sont surchargés ou le quota gratuit est atteint (essayés : ${tried}). `
    + 'Réessayez dans quelques minutes avec « Relancer l\'analyse ».',
    { kind: 'busy', cause }
  );
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
  if (!process.env.GEMINI_API_KEY) throw missingKey();
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
      if (classifyGeminiError(error) === 'key') throw refusedKey(error);

      const isRetryable =
        error.message?.includes('429') ||
        error.message?.includes('503');

      if (!isRetryable || attempt === EMBED_MAX_RETRIES) throw error;

      // Limite de débit atteinte : on attend de plus en plus longtemps
      await wait(attempt * 2000);
    }
  }
};
