// tests/api/seed.api.test.js — Bloc 22
// Les données de test sont insérées dans veridian_test, puis lues par les VRAIES routes :
// on vérifie qu'elles ressemblent au résultat de la vraie chaîne (tâches liées aux acteurs,
// réunions analysées, projet créé par une réunion, alertes, risques, courriels, calendrier)
// et que l'isolation entre utilisateurs est respectée.
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';

const { fakeGenerativeAIModule } = await import('./helpers.js');
jest.unstable_mockModule('@google/generative-ai', fakeGenerativeAIModule);

const { default: app } = await import('../../app.js');
const { default: pool } = await import('../../src/config/db.js');
const { seedTestData, SEED_USERS, SEED_PASSWORD } = await import('../../database/seed.js');

const sessions = {};
const as = (key) => ({
  get: (url) => request(app).get(url).set({ Authorization: `Bearer ${sessions[key]}` }),
  post: (url, body) => request(app).post(url).set({ Authorization: `Bearer ${sessions[key]}` }).send(body),
});
let firstRun;
const silent = () => {};

beforeAll(async () => {
  firstRun = await seedTestData(pool, { withEmbeddings: true, log: silent });
  for (const u of SEED_USERS) {
    const res = await request(app).post('/api/auth/login').send({ email: u.email, password: SEED_PASSWORD });
    sessions[u.key] = res.body.token;
  }
});
afterAll(async () => { await pool.end(); });

const projectNamed = async (key, name) => (await as(key).get('/api/projects')).body.projects.find((p) => p.name === name);
const meetingTitled = async (key, title) => (await as(key).get('/api/meetings')).body.meetings.find((m) => m.title === title);

describe('Insertion', () => {
  test('tout est créé en une fois, mémoire vectorielle comprise', () => {
    expect(firstRun.created).toBe(true);
    expect(firstRun.counts).toMatchObject({ projects: 4, meetings: 8, alerts: 2, risks: 4 });
    expect(firstRun.counts.tasks).toBeGreaterThanOrEqual(15);
    expect(firstRun.indexed).toBe(7); // 7 réunions transcrites
  });

  test('relancer le script ne duplique rien', async () => {
    expect(await seedTestData(pool, { log: silent })).toEqual({ created: false });
  });

  test('les 3 comptes se connectent avec le mot de passe documenté', () => {
    for (const u of SEED_USERS) expect(sessions[u.key]).toEqual(expect.any(String));
  });
});

describe('Résultats comme ceux de la vraie analyse', () => {
  test('« Mes tâches » de Marie : ses tâches, liées à son compte, avec échéance à 17 h UTC', async () => {
    const tasks = (await as('marie').get('/api/tasks')).body.tasks.filter((t) => t.assignee_id);
    const mine = tasks.filter((t) => t.assignee === 'Marie Tremblay');
    expect(mine.length).toBeGreaterThanOrEqual(5);
    for (const t of mine.filter((x) => x.due_date)) expect(new Date(t.due_date).getUTCHours()).toBe(17);
  });

  test('réunion de contradiction : analysée, alerte, risques, tâches par acteur, courriels', async () => {
    const meeting = await meetingTitled('admin', 'Suivi technique - hébergement et sécurité');
    const details = (await as('admin').get(`/api/meetings/${meeting.id}/details`)).body;
    expect(details.meeting).toMatchObject({ analysis_status: 'done', transcription_status: 'done' });
    expect(details.alerts).toHaveLength(1);
    expect(details.risks).toHaveLength(2);
    expect(details.tasks.every((t) => t.assignee_id)).toBe(true);
    expect(details.notifications.map((n) => n.kind).sort()).toEqual(['actor', 'actor', 'summary']);
    // Le projet créé par cette réunion est signalé « nouveau »
    const boutique = details.projects.find((p) => p.name === 'Boutique en ligne');
    expect(boutique.is_new).toBe(true);
  });

  test('scénario Atlas en 3 réunions : création, contradiction, mise à jour', async () => {
    const atlas = await projectNamed('marie', 'Application mobile Atlas');
    const meetings = (await as('marie').get(`/api/meetings/project/${atlas.id}`)).body.meetings.map((m) => m.title);
    expect(meetings).toEqual(expect.arrayContaining(['Définition des fonctionnalités', 'Point budget et démonstration client', "Point d'avancement"]));
    const alerts = (await as('marie').get(`/api/alerts/project/${atlas.id}`)).body.alerts;
    expect(alerts).toHaveLength(1);
    expect(alerts[0].explanation).toMatch(/notifications push/);
  });

  test('Samuel, acteur du projet créé, en est membre et y voit sa tâche', async () => {
    const boutique = await projectNamed('samuel', 'Boutique en ligne');
    expect(boutique).toBeTruthy();
    const tasks = (await as('samuel').get('/api/tasks')).body.tasks.map((t) => t.title);
    expect(tasks).toContain('Recenser les produits à mettre en ligne');
  });

  test('calendrier : la réunion planifiée apparaît à sa date prévue', async () => {
    const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const res = await as('admin').get(`/api/calendar?from=${day(-1)}&to=${day(7)}`);
    const planned = res.body.meetings.find((m) => m.title === 'Revue de sprint');
    expect(planned.scheduled_at).toBeTruthy();
    expect(res.body.tasks.length).toBeGreaterThan(0);
  });

  test('tableau de bord d\'Admin : tâche en retard et alertes ouvertes', async () => {
    const res = (await as('admin').get('/api/dashboard')).body;
    expect(res.my_overdue_tasks).toBeGreaterThanOrEqual(1);
    expect(res.open_alerts).toBe(2);
  });

  // L'IA simulée compare les mots : la question reprend donc ceux de la décision indexée
  test('chat mémoire : réponse appuyée sur les réunions indexées', async () => {
    const refonte = await projectNamed('admin', 'Refonte du site web client');
    const question = "Pourquoi migrer l'hébergement vers le serveur interne (Docker) plutôt que Cloudflare Pages ? Le client exige que les données restent au Canada";
    const res = await as('admin').post('/api/memory/chat', { question, projectId: refonte.id });
    expect(res.status).toBe(200);
    expect(res.body.hasContext).toBe(true);
  });
});

describe('Isolation des données', () => {
  test('le projet confidentiel de Samuel est invisible pour Marie et Admin', async () => {
    const rh = await projectNamed('samuel', 'Plan de relève RH (confidentiel)');
    expect(rh).toBeTruthy();
    for (const key of ['marie', 'admin']) {
      expect((await as(key).get(`/api/projects/${rh.id}`)).status).toBe(404);
      const all = JSON.stringify((await as(key).get('/api/projects')).body);
      expect(all).not.toContain('Plan de relève');
    }
  });
});
