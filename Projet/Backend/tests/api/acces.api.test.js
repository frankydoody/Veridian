// tests/api/acces.api.test.js — Bloc 17
// Contrôle d'accès : un utilisateur B, qui n'est PAS membre du projet de A, ne peut rien lire
// ni rien modifier. Toutes les routes répondent 404 (jamais 403) : B n'apprend même pas que la
// ressource existe. On vérifie aussi, en base, que rien n'a été modifié.
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

const { fakeGenerativeAIModule, aiState, makeClient, waitForAnalysis, unique } = await import('./helpers.js');
jest.unstable_mockModule('@google/generative-ai', fakeGenerativeAIModule);

const { default: app } = await import('../../app.js');
const { default: pool, query } = await import('../../src/config/db.js');

const { register, as } = makeClient(app);
const PROJECT = `Projet privé ${unique()}`;
let a, b, project, meeting, transcription, task, alertId, conversation;

beforeAll(async () => {
  a = await register('Alice');
  b = await register('Bruno');
  project = (await as(a).post('/api/projects', { name: PROJECT })).body.project;
  meeting = (await as(a).post('/api/meetings', { projectId: project.id, title: 'Réunion privée' })).body.meeting;

  // Deux analyses : une décision, puis une décision contraire → une alerte
  aiState.analysis = {
    projects: [{ name: PROJECT }],
    decisions: [{ project: PROJECT, content: 'Développer en Flutter', confidence: 90 }],
    tasks: [{ project: PROJECT, title: 'Tâche privée', assignee: 'Alice', priority: 'haute', dueDate: '2099-01-10' }],
  };
  await as(a).post('/api/transcriptions/text', { meetingId: meeting.id, rawText: 'On développe en Flutter.' });
  await waitForAnalysis(as(a), meeting.id);
  const second = (await as(a).post('/api/meetings', { projectId: project.id, title: 'Suite' })).body.meeting;
  aiState.analysis = { ...aiState.analysis, decisions: [{ project: PROJECT, content: 'Passer à React Native', confidence: 80 }], tasks: [] };
  await as(a).post('/api/transcriptions/text', { meetingId: second.id, rawText: 'On passe à React Native.' });
  await waitForAnalysis(as(a), second.id);

  transcription = (await as(a).get(`/api/transcriptions/meeting/${meeting.id}`)).body.transcription;
  task = (await as(a).get('/api/tasks')).body.tasks.find((t) => t.title === 'Tâche privée');
  alertId = (await as(a).get(`/api/alerts/project/${project.id}`)).body.alerts[0].id;
  conversation = (await as(a).post('/api/chat/conversations', { projectId: project.id })).body.conversation;
});
afterAll(async () => { await pool.end(); });

describe('Prérequis : A a bien des données', () => {
  test('transcription, tâche, alerte et conversation existent', () => {
    expect(transcription?.id).toBeTruthy();
    expect(task?.id).toBeTruthy();
    expect(alertId).toBeTruthy();
    expect(conversation?.id).toBeTruthy();
  });
});

describe('B ne lit rien du projet de A → 404', () => {
  const reads = () => [
    `/api/projects/${project.id}`,
    `/api/projects/${project.id}/members`,
    `/api/projects/${project.id}/export/pdf`,
    `/api/meetings/project/${project.id}`,
    `/api/meetings/${meeting.id}`,
    `/api/meetings/${meeting.id}/details`,
    `/api/meetings/${meeting.id}/analysis`,
    `/api/meetings/${meeting.id}/audio`,
    `/api/transcriptions/meeting/${meeting.id}`,
    `/api/decisions/project/${project.id}`,
    `/api/decisions/meeting/${meeting.id}`,
    `/api/alerts/project/${project.id}`,
    `/api/memory/chunks/${meeting.id}`,
    `/api/chat/conversations/${conversation.id}`,
    `/api/calendar?from=2099-01-01&to=2099-01-31&projectId=${project.id}`,
  ];

  test.each([...Array(15).keys()])('lecture n° %i', async (i) => {
    const url = reads()[i];
    const res = await as(b).get(url);
    expect({ url, status: res.status }).toEqual({ url, status: 404 });
    expect(JSON.stringify(res.body)).not.toContain(PROJECT);
  });

  test('les listes de B ne contiennent rien de A', async () => {
    const lists = await Promise.all(['/api/projects', '/api/meetings', '/api/tasks'].map((u) => as(b).get(u)));
    for (const res of lists) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(PROJECT);
      expect(JSON.stringify(res.body)).not.toContain('Tâche privée');
    }
    const calendar = await as(b).get('/api/calendar?from=2099-01-01&to=2099-01-31');
    expect(calendar.body.tasks).toHaveLength(0);
    const dashboard = await as(b).get('/api/dashboard');
    expect(dashboard.body.open_alerts).toBe(0);
  });
});

describe('B ne modifie rien → 404, et rien ne change en base', () => {
  test('projet : modification, statut, membres', async () => {
    expect((await as(b).put(`/api/projects/${project.id}`, { name: 'Piraté' })).status).toBe(404);
    expect((await as(b).patch(`/api/projects/${project.id}/status`, { status: 'archived' })).status).toBe(404);
    expect((await as(b).post(`/api/projects/${project.id}/members`, { email: b.email })).status).toBe(404);
    expect((await as(b).delete(`/api/projects/${project.id}/members/${a.user.id}`)).status).toBe(404);
    const row = (await query('SELECT name, status FROM projects WHERE id = $1', [project.id])).rows[0];
    expect(row).toEqual({ name: PROJECT, status: 'active' });
  });

  test('réunion : création dans le projet, statut, analyse, transcription', async () => {
    expect((await as(b).post('/api/meetings', { projectId: project.id, title: 'Intrusion' })).status).toBe(404);
    expect((await as(b).patch(`/api/meetings/${meeting.id}/status`, { status: 'cancelled' })).status).toBe(404);
    expect((await as(b).post(`/api/meetings/${meeting.id}/analyze`)).status).toBe(404);
    expect((await as(b).post('/api/transcriptions/text', { meetingId: meeting.id, rawText: 'Texte injecté' })).status).toBe(404);
    expect((await as(b).put(`/api/transcriptions/${transcription.id}`, { rawText: 'Texte remplacé' })).status).toBe(404);
    expect((await as(b).post(`/api/decisions/extract/${meeting.id}`)).status).toBe(404);
    expect((await as(b).post(`/api/memory/index/${meeting.id}`)).status).toBe(404);
    const t = (await query('SELECT raw_text FROM transcriptions WHERE id = $1', [transcription.id])).rows[0];
    expect(t.raw_text).toBe('On développe en Flutter.');
  });

  test('tâche : création dans le projet, modification, statut, suppression', async () => {
    expect((await as(b).post('/api/tasks', { title: 'Intrusion', project_id: project.id })).status).toBe(404);
    expect((await as(b).put(`/api/tasks/${task.id}`, { title: 'Piraté' })).status).toBe(404);
    expect((await as(b).patch(`/api/tasks/${task.id}/status`, { status: 'done' })).status).toBe(404);
    expect((await as(b).delete(`/api/tasks/${task.id}`)).status).toBe(404);
    const row = (await query('SELECT title, status, is_active FROM tasks WHERE id = $1', [task.id])).rows[0];
    expect(row).toEqual({ title: 'Tâche privée', status: 'todo', is_active: true });
  });

  test('alerte, chat et mémoire', async () => {
    expect((await as(b).patch(`/api/alerts/${alertId}/resolve`)).status).toBe(404);
    expect((await as(b).post('/api/chat/conversations', { projectId: project.id })).status).toBe(404);
    expect((await as(b).post(`/api/chat/conversations/${conversation.id}/messages`, { question: 'Flutter ?' })).status).toBe(404);
    expect((await as(b).delete(`/api/chat/conversations/${conversation.id}`)).status).toBe(404);
    expect((await as(b).post('/api/memory/chat', { question: 'Flutter ?', projectId: project.id })).status).toBe(404);
    expect((await as(b).post('/api/memory/chat', { question: 'Flutter ?', meetingId: meeting.id })).status).toBe(404);
    const alert = (await query('SELECT resolved_at FROM alerts WHERE id = $1', [alertId])).rows[0];
    expect(alert.resolved_at).toBeNull();
  });
});

describe('Identifiants mal formés → 400, jamais 500', () => {
  test.each([
    ['get', '/api/projects/abc'],
    ['get', '/api/meetings/abc'],
    ['get', '/api/meetings/abc/details'],
    ['get', '/api/meetings/project/abc'],
    ['put', '/api/tasks/abc'],
    ['get', '/api/decisions/project/abc'],
    ['get', '/api/alerts/project/abc'],
    ['get', '/api/transcriptions/meeting/abc'],
    ['get', '/api/memory/chunks/abc'],
    ['post', '/api/memory/chat'],
  ])('%s %s', async (method, url) => {
    const body = url === '/api/memory/chat' ? { question: 'Flutter ?', projectId: 'abc' } : { title: 'x' };
    const res = await as(b)[method](url, body);
    expect(res.status).toBe(400);
  });
});
