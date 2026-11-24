import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Correctif Gemini — modèle par défaut, modèles de secours et messages d'erreur en français.
// Le SDK est simulé : chaque modèle répond ce que le test décide (messages réels de l'API).
process.env.GEMINI_API_KEY = 'cle-de-test';
delete process.env.AI_MODEL;

const behaviour = {}; // nom du modèle → fonction exécutée à l'appel
jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }) {
      return {
        generateContent: async () => {
          const run = behaviour[model];
          if (!run) throw new Error(`modèle inattendu : ${model}`);
          return { response: { text: () => run() } };
        },
        embedContent: async () => behaviour.embed(),
      };
    }
  },
}));
const {
  generateWithFallback, embedText, fallbackModels, classifyGeminiError, DEFAULT_MODEL,
} = await import('../../src/config/gemini.js');

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const fail = (status, message) => () => { throw new Error(`[GoogleGenerativeAI Error]: Error fetching from ${API}: [${status}] ${message}`); };
const INVALID_KEY = fail('400 Bad Request', 'API key not valid. Please pass a valid API key. [{"reason":"API_KEY_INVALID"}]');
const RETIRED = fail('404 Not Found', 'This model models/gemini-2.5-flash is no longer available to new users.');
const BUSY = fail('503 Service Unavailable', 'This model is currently experiencing high demand.');

beforeEach(() => {
  for (const k of Object.keys(behaviour)) delete behaviour[k];
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('Modèles', () => {
  test('défaut gemini-3.5-flash, puis les alias « -latest », sans doublon', () => {
    expect(DEFAULT_MODEL).toBe('gemini-3.5-flash');
    expect(fallbackModels(undefined)).toEqual(['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']);
    expect(fallbackModels('gemini-flash-latest')).toEqual(['gemini-flash-latest', 'gemini-flash-lite-latest']);
  });

  test('classement des erreurs réelles de l\'API', () => {
    const err = (f) => { try { f(); } catch (e) { return e; } return null; };
    expect(classifyGeminiError(err(INVALID_KEY))).toBe('key');
    expect(classifyGeminiError(err(RETIRED))).toBe('model');
    expect(classifyGeminiError(err(BUSY))).toBe('busy');
    expect(classifyGeminiError(new Error('fetch failed'))).toBe('other');
  });
});

describe('generateWithFallback', () => {
  test('modèle principal disponible → sa réponse', async () => {
    behaviour['gemini-3.5-flash'] = () => 'OK';
    await expect(generateWithFallback('question')).resolves.toBe('OK');
  });

  test('modèle retiré ou surchargé → modèle de secours suivant', async () => {
    behaviour['gemini-3.5-flash'] = RETIRED;
    behaviour['gemini-flash-latest'] = BUSY;
    behaviour['gemini-flash-lite-latest'] = () => 'secours';
    await expect(generateWithFallback('question')).resolves.toBe('secours');
  });

  test('clé refusée → message clair, AUCUN autre modèle essayé', async () => {
    behaviour['gemini-3.5-flash'] = INVALID_KEY;
    behaviour['gemini-flash-latest'] = jest.fn(() => 'ne doit pas être appelé');
    const error = await generateWithFallback('question').catch((e) => e);
    expect(error.name).toBe('GeminiError');
    expect(error.message).toMatch(/^Clé Gemini refusée par Google : vérifiez GEMINI_API_KEY/);
    expect(error.message).not.toMatch(/googleapis|API_KEY_INVALID/);
    expect(error.cause.message).toMatch(/API_KEY_INVALID/); // le détail reste disponible pour la console
    expect(behaviour['gemini-flash-latest']).not.toHaveBeenCalled();
  });

  test('tous les modèles retirés → message qui nomme les modèles essayés et AI_MODEL', async () => {
    for (const m of fallbackModels()) behaviour[m] = RETIRED;
    await expect(generateWithFallback('q')).rejects.toThrow(/Aucun modèle Gemini disponible.*gemini-3\.5-flash, gemini-flash-latest, gemini-flash-lite-latest.*AI_MODEL/);
  });

  test('surcharge générale → invitation à réessayer', async () => {
    for (const m of fallbackModels()) behaviour[m] = BUSY;
    await expect(generateWithFallback('q')).rejects.toThrow(/surchargés ou le quota gratuit est atteint/);
  });

  test('autre erreur (réseau) → transmise telle quelle', async () => {
    behaviour['gemini-3.5-flash'] = () => { throw new Error('fetch failed'); };
    await expect(generateWithFallback('q')).rejects.toThrow('fetch failed');
  });

  test('clé absente → message clair, sans appel à Google', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    behaviour['gemini-3.5-flash'] = jest.fn(() => 'OK');
    await expect(generateWithFallback('q')).rejects.toThrow(/^Clé Gemini absente/);
    expect(behaviour['gemini-3.5-flash']).not.toHaveBeenCalled();
    process.env.GEMINI_API_KEY = saved;
  });
});

describe('embedText', () => {
  test('vecteur de 768 dimensions', async () => {
    behaviour.embed = () => ({ embedding: { values: new Array(3072).fill(0.1) } });
    await expect(embedText('texte')).resolves.toHaveLength(768);
  });

  test('clé refusée → même message clair', async () => {
    behaviour.embed = INVALID_KEY;
    await expect(embedText('texte')).rejects.toThrow(/^Clé Gemini refusée par Google/);
  });
});
