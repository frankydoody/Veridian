// tests/api/pipeline.api.test.js — Bloc 17
// Chaîne complète sur veridian_test, par les vraies routes : transcription collée → analyse
// (IA simulée) → projets, décisions, tâches liées aux acteurs avec dates → contradiction et
// risques → courriels (mode console) → mémoire vectorielle et chat → export PDF.
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';

const { fakeGenerativeAIModule, aiState, makeClient, waitForAnalysis, unique } = await import('./helpers.js');
jest.unstable_mockModule('@google/generative-ai', fakeGenerativeAIModule);

const { default: app } = await import('../../app.js');
const { default: pool, query } = await import('../../src/config/db.js');

const { register, as } = makeClient(app);
const PROJECT = `Application mobile ${unique()}`;
const NEW_PROJECT = `Portail fournisseurs ${unique()}`;
let owner, actor, project, first, second;

const createMeeting = async (title) =>
  (await as(owner).post('/api/meetings', { projectId: project.id, title })).body.meeting;
const submitText = (meeting, rawText) =>
  as(owner).post('/api/transcriptions/text', { meetingId: meeting.id, rawText });

beforeAll(async () => {
  owner = await register('Organisatrice');
  actor = await register('Julie');
  project = (await as(owner).post('/api/projects', { name: PROJECT })).body.project;
  await as(owner).post(`/api/projects/${project.id}/members`, { email: actor.email });
});
afterAll(async () => { await pool.end(); });

describe('Première réunion : décision Flutter', () => {
  test('texte collé → 201, analyse en arrière-plan → terminée', async () => {
    aiState.analysis = {
      projects: [{ name: PROJECT }],
      decisions: [{ project: PROJECT, content: 'Développer l\'application en Flutter', confidence: 90 }],
      tasks: [{ project: PROJECT, title: 'Installer Flutter', assignee: 'Julie', priority: 'moyenne', dueDate: null }],
    };
    first = await createMeeting('Lancement');
    const res = await submitText(first, 'On a décidé de développer l\'application en Flutter. Julie installe Flutter.');
    expect(res.status).toBe(201);
    const state = await waitForAnalysis(as(owner), first.id);
    expect(state.analysis_status).toBe('done');
  });

  test('tâche liée au compte de Julie, date estimée faute de date dite', async () => {
    const details = (await as(owner).get(`/api/meetings/${first.id}/details`)).body;
    expect(details.decisions.map((d) => d.content)).toEqual(['Développer l\'application en Flutter']);
    expect(details.tasks).toHaveLength(1);
    expect(details.tasks[0]).toMatchObject({ assignee_id: actor.user.id, due_estimated: true });
    expect(details.tasks[0].due_date).toBeTruthy();
  });
});

describe('Deuxième réunion : contradiction, nouveau projet, courriels', () => {
  test('analyse : projet existant réutilisé, nouveau projet créé', async () => {
    aiState.analysis = {
      projects: [{ name: PROJECT }, { name: NEW_PROJECT, description: 'Créé par la réunion' }],
      decisions: [
        { project: PROJECT, content: 'Abandonner Flutter et développer en React Native', confidence: 85 },
        { project: NEW_PROJECT, content: 'Le portail sera une application web', confidence: 80 },
      ],
      tasks: [
        { project: PROJECT, title: 'Maquettes de l\'accueil', assignee: 'Julie', priority: 'haute', dueDate: '2099-12-05' },
        { project: NEW_PROJECT, title: 'Cahier des charges du portail', assignee: 'Julie', priority: 'moyenne', dueDate: '2099-12-12' },
        { project: PROJECT, title: 'Valider avec le client', assignee: 'Quelqu\'un du client', priority: 'basse', dueDate: null },
      ],
    };
    second = await createMeeting('Revue');
    expect((await submitText(second, 'Finalement on passe à React Native. Julie fait les maquettes.')).status).toBe(201);
    expect((await waitForAnalysis(as(owner), second.id)).analysis_status).toBe('done');

    const details = (await as(owner).get(`/api/meetings/${second.id}/details`)).body;
    const byName = Object.fromEntries(details.projects.map((p) => [p.name, p]));
    expect(byName[PROJECT].is_new).toBe(false);
    expect(byName[NEW_PROJECT].is_new).toBe(true);
    // Une date donnée est conservée (17 h UTC) ; un nom sans compte reste « non lié »
    const maquettes = details.tasks.find((t) => t.title === 'Maquettes de l\'accueil');
    expect(new Date(maquettes.due_date).toISOString()).toBe('2099-12-05T17:00:00.000Z');
    expect(maquettes.due_estimated).toBe(false);
    const client = details.tasks.find((t) => t.title === 'Valider avec le client');
    expect(client.assignee_id).toBeNull();
  });

  test('contradiction avec la décision Flutter → alerte ; risques enregistrés', async () => {
    const details = (await as(owner).get(`/api/meetings/${second.id}/details`)).body;
    expect(details.alerts.length).toBeGreaterThanOrEqual(1);
    expect(details.alerts[0].explanation).toMatch(/Flutter/);
    expect(details.risks.length).toBeGreaterThanOrEqual(1);
    const alerts = (await as(owner).get(`/api/alerts/project/${project.id}`)).body.alerts;
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const resolved = await as(owner).patch(`/api/alerts/${alerts[0].id}/resolve`);
    expect(resolved.status).toBe(200);
  });

  test('courriels : un par acteur et un résumé pour l\'organisatrice (mode console)', async () => {
    const details = (await as(owner).get(`/api/meetings/${second.id}/details`)).body;
    const emails = details.notifications.map((n) => [n.email, n.kind, n.status]);
    expect(emails).toEqual(expect.arrayContaining([
      [actor.email, 'actor', 'logged'],
      [owner.email, 'summary', 'logged'],
    ]));
  });

  test('Julie devient membre du projet créé et voit ses deux tâches', async () => {
    const tasks = (await as(actor).get('/api/tasks')).body.tasks.map((t) => t.title);
    expect(tasks).toEqual(expect.arrayContaining(['Maquettes de l\'accueil', 'Cahier des charges du portail']));
  });

  test('relancer l\'analyse remplace le résultat au lieu de le dupliquer', async () => {
    const before = (await as(owner).get(`/api/meetings/${second.id}/details`)).body.tasks.length;
    expect((await as(owner).post(`/api/meetings/${second.id}/analyze`)).status).toBe(202);
    expect((await waitForAnalysis(as(owner), second.id)).analysis_status).toBe('done');
    const after = (await as(owner).get(`/api/meetings/${second.id}/details`)).body.tasks.length;
    expect(after).toBe(before);
    const created = await query('SELECT COUNT(*)::int AS n FROM projects WHERE name = $1', [NEW_PROJECT]);
    expect(created.rows[0].n).toBe(1);
  });
});

describe('Décisions, mémoire, chat et PDF', () => {
  test('décisions du projet et de la réunion', async () => {
    const byProject = await as(owner).get(`/api/decisions/project/${project.id}`);
    expect(byProject.status).toBe(200);
    expect(byProject.body.decisions.length).toBeGreaterThanOrEqual(2);
    expect((await as(owner).get(`/api/decisions/meeting/${first.id}`)).body.decisions).toHaveLength(1);
  });

  test('mémoire vectorielle : extraits indexés, recherche sémantique (pgvector)', async () => {
    const chunks = await as(owner).get(`/api/memory/chunks/${first.id}`);
    expect(chunks.status).toBe(200);
    expect(chunks.body.chunks.length).toBeGreaterThanOrEqual(1);
    const res = await as(owner).post('/api/memory/chat', { question: 'Pourquoi Flutter pour l\'application ?', projectId: project.id });
    expect(res.status).toBe(200);
    expect(res.body.hasContext).toBe(true);
    expect(res.body.answer).toMatch(/Réponse simulée/);
  });

  test('conversation : question, réponse enregistrées, historique', async () => {
    const conversation = (await as(owner).post('/api/chat/conversations', { projectId: project.id, title: 'Choix techniques' })).body.conversation;
    const asked = await as(owner).post(`/api/chat/conversations/${conversation.id}/messages`, { question: "Pourquoi développer l'application en Flutter ?" });
    expect(asked.status).toBe(201);
    expect(asked.body.assistantMessage.content).toMatch(/Réponse simulée/);
    const history = await as(owner).get(`/api/chat/conversations/${conversation.id}`);
    expect(history.body.conversation.messages ?? history.body.messages).toHaveLength(2);
    expect((await as(owner).delete(`/api/chat/conversations/${conversation.id}`)).status).toBeLessThan(300);
  });

  test('export PDF du projet : un vrai fichier PDF', async () => {
    const res = await request(app).get(`/api/projects/${project.id}/export/pdf`)
      .set({ Authorization: `Bearer ${owner.token}` })
      .buffer(true).parse((r, cb) => { const parts = []; r.on('data', (c) => parts.push(c)); r.on('end', () => cb(null, Buffer.concat(parts))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
