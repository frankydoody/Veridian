// tests/api/helpers.js — Bloc 17
// Outils partagés des tests d'API : IA simulée, comptes, attente d'un traitement en arrière-plan.
//
// L'IA est la SEULE chose simulée : la base, les routes HTTP, les contrôles d'accès, la mémoire
// vectorielle (pgvector), les courriels (mode console) et le PDF sont réels.
import request from 'supertest';

// ─── IA simulée ──────────────────────────────────────────────────────────────
const DIMENSIONS = 768;

/**
 * Vecteur déterministe tiré des mots du texte : deux textes qui partagent des mots ont des
 * vecteurs proches. La recherche sémantique de pgvector fonctionne donc vraiment en test.
 */
export const fakeEmbedding = (text) => {
  const vector = new Array(DIMENSIONS).fill(0);
  const words = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) ?? [];
  for (const word of words) {
    let hash = 0;
    for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) % 100003;
    vector[hash % DIMENSIONS] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
};

/**
 * État modifiable par chaque test : ce que « l'IA » répondra.
 * analysis : résultat de l'analyse d'une réunion (projets, décisions, tâches).
 */
export const aiState = {
  analysis: { projects: [], decisions: [], tasks: [] },
  calls: [],
};

const answer = (prompt) => {
  if (prompt.includes('éléments de gestion de projet')) {
    aiState.calls.push('analysis');
    return aiState.analysis;
  }
  if (prompt.includes('Nouvelle décision')) {
    aiState.calls.push('contradiction');
    // Contradiction volontaire : une décision « React Native » contredit une décision « Flutter »
    const conflict = /React Native/i.test(prompt.split('Nouvelle décision')[1] ?? '') && /Flutter/i.test(prompt);
    return conflict
      ? { hasContradiction: true, conflictIndex: 1, severity: 'high', explanation: 'React Native remplace Flutter, décidé plus tôt.' }
      : { hasContradiction: false };
  }
  if (prompt.includes('chef de projet')) {
    aiState.calls.push('risks');
    return [{ kind: 'echeance', description: 'Échéance serrée pour le prototype', severity: 'medium', mitigation: 'Prévoir une marge' }];
  }
  if (prompt.includes('assistant mémoire')) {
    aiState.calls.push('chat');
    return 'Réponse simulée : la décision se trouve dans la source 1.';
  }
  aiState.calls.push('autre');
  return {};
};

// Module « @google/generative-ai » de remplacement, pour jest.unstable_mockModule
export const fakeGenerativeAIModule = () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async (prompt) => {
          const out = answer(String(prompt));
          return { response: { text: () => (typeof out === 'string' ? out : JSON.stringify(out)) } };
        },
        embedContent: async ({ content }) => ({ embedding: { values: fakeEmbedding(content.parts[0].text) } }),
      };
    }
  },
});

// ─── Comptes et requêtes ─────────────────────────────────────────────────────
let counter = 0;
export const unique = () => `${Date.now().toString(36)}${(counter += 1)}${Math.random().toString(36).slice(2, 6)}`;

export const PASSWORD = 'motdepasse-test';

export const makeClient = (app) => {
  const register = async (name) => {
    const email = `api-${name.toLowerCase().replace(/[^a-z]/g, '')}-${unique()}@example.test`;
    const res = await request(app).post('/api/auth/register').send({ name, email, password: PASSWORD });
    if (res.status !== 201) throw new Error(`Inscription impossible (${res.status}) : ${JSON.stringify(res.body)}`);
    return { token: res.body.token, user: res.body.user, email };
  };
  const auth = (account) => ({ Authorization: `Bearer ${account.token}` });
  const as = (account) => ({
    get: (url) => request(app).get(url).set(auth(account)),
    post: (url, body) => request(app).post(url).set(auth(account)).send(body),
    put: (url, body) => request(app).put(url).set(auth(account)).send(body),
    patch: (url, body) => request(app).patch(url).set(auth(account)).send(body),
    delete: (url) => request(app).delete(url).set(auth(account)),
  });
  return { register, as };
};

/** Attend qu'une condition asynchrone soit vraie (traitement en arrière-plan). */
export const waitFor = async (check, { timeout = 15000, interval = 100, label = 'condition' } = {}) => {
  const start = Date.now();
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() - start > timeout) throw new Error(`Délai dépassé en attendant : ${label}`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

/** Attend la fin de l'analyse d'une réunion et renvoie son état. */
export const waitForAnalysis = (client, meetingId) =>
  waitFor(async () => {
    const res = await client.get(`/api/meetings/${meetingId}/analysis`);
    return res.body.analysis_status && res.body.analysis_status !== 'processing' ? res.body : null;
  }, { label: `analyse de la réunion ${meetingId}` });
