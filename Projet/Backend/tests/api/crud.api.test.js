// tests/api/crud.api.test.js — Bloc 17
// Projets, membres, réunions et tâches de bout en bout, par les vraies routes, sur veridian_test.
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const { default: app } = await import('../../app.js');
const { default: pool, query } = await import('../../src/config/db.js');
const { makeClient } = await import('./helpers.js');

const { register, as } = makeClient(app);
let owner, member, project;

beforeAll(async () => {
  owner = await register('Proprietaire');
  member = await register('Membre');
});
afterAll(async () => { await pool.end(); });

describe('Projets', () => {
  test('création → 201 ; le créateur en est propriétaire et membre', async () => {
    const res = await as(owner).post('/api/projects', { name: '  Atlas  ', description: 'Projet de test' });
    expect(res.status).toBe(201);
    project = res.body.project;
    expect(project).toMatchObject({ name: 'Atlas', owner_id: owner.user.id, status: 'active' });
    const members = await as(owner).get(`/api/projects/${project.id}/members`);
    expect(members.body.members).toEqual([expect.objectContaining({ id: owner.user.id, role: 'owner' })]);
  });

  test('nom manquant ou trop long → 400', async () => {
    expect((await as(owner).post('/api/projects', { name: '' })).status).toBe(400);
    expect((await as(owner).post('/api/projects', { name: 'x'.repeat(151) })).status).toBe(400);
  });

  test('liste, lecture et modification', async () => {
    const list = await as(owner).get('/api/projects');
    expect(list.body.projects.map((p) => p.id)).toContain(project.id);
    expect((await as(owner).get(`/api/projects/${project.id}`)).body.project.name).toBe('Atlas');
    const updated = await as(owner).put(`/api/projects/${project.id}`, { name: 'Atlas 2', description: 'Modifié' });
    expect(updated.status).toBe(200);
    expect(updated.body.project.name).toBe('Atlas 2');
  });

  test('changement de statut validé', async () => {
    expect((await as(owner).patch(`/api/projects/${project.id}/status`, { status: 'n-importe-quoi' })).status).toBe(400);
    const archived = await as(owner).patch(`/api/projects/${project.id}/status`, { status: 'archived' });
    expect(archived.status).toBe(200);
    expect(archived.body.project.status).toBe('archived');
    await as(owner).patch(`/api/projects/${project.id}/status`, { status: 'active' });
  });

  test('identifiant mal formé → 400 (pas d\'erreur 500 de PostgreSQL)', async () => {
    expect((await as(owner).get('/api/projects/pas-un-uuid')).status).toBe(400);
  });
});

describe('Membres', () => {
  test('ajout par courriel exact, doublon refusé, inconnu → 404', async () => {
    const added = await as(owner).post(`/api/projects/${project.id}/members`, { email: member.email.toUpperCase() });
    expect(added.status).toBe(201);
    expect((await as(owner).post(`/api/projects/${project.id}/members`, { email: member.email })).status).toBe(409);
    expect((await as(owner).post(`/api/projects/${project.id}/members`, { email: 'personne@example.test' })).status).toBe(404);
  });

  test('un membre voit le projet ; seul le propriétaire gère les membres', async () => {
    expect((await as(member).get(`/api/projects/${project.id}`)).status).toBe(200);
    const third = await register('Troisieme');
    expect((await as(member).post(`/api/projects/${project.id}/members`, { email: third.email })).status).toBe(403);
  });

  test('retrait logique : le membre perd l\'accès, la ligne reste en base', async () => {
    const extra = await register('Retire');
    await as(owner).post(`/api/projects/${project.id}/members`, { email: extra.email });
    expect((await as(owner).delete(`/api/projects/${project.id}/members/${extra.user.id}`)).status).toBe(200);
    expect((await as(extra).get(`/api/projects/${project.id}`)).status).toBe(404);
    const row = (await query('SELECT is_active FROM project_members WHERE project_id = $1 AND user_id = $2', [project.id, extra.user.id])).rows[0];
    expect(row.is_active).toBe(false);
    // Le propriétaire ne peut pas être retiré
    expect((await as(owner).delete(`/api/projects/${project.id}/members/${owner.user.id}`)).status).not.toBe(200);
  });
});

describe('Réunions', () => {
  let meeting;
  test('création (avec date prévue), liste, lecture, statut', async () => {
    const res = await as(owner).post('/api/meetings', { projectId: project.id, title: 'Revue', scheduledAt: '2026-12-05T15:00:00.000Z' });
    expect(res.status).toBe(201);
    meeting = res.body.meeting;
    expect((await as(member).get('/api/meetings')).body.meetings.map((m) => m.id)).toContain(meeting.id);
    expect((await as(owner).get(`/api/meetings/project/${project.id}`)).body.meetings).toHaveLength(1);
    expect((await as(owner).get(`/api/meetings/${meeting.id}`)).body.meeting.title).toBe('Revue');
    const status = await as(owner).patch(`/api/meetings/${meeting.id}/status`, { status: 'done' });
    expect(status.status).toBe(200);
    expect((await as(owner).patch(`/api/meetings/${meeting.id}/status`, { status: 'inconnu' })).status).toBe(400);
  });

  test('détail : réunion sans transcription ni audio', async () => {
    const res = await as(owner).get(`/api/meetings/${meeting.id}/details`);
    expect(res.status).toBe(200);
    expect(res.body.meeting.has_audio).toBe(false);
    expect(res.body.meeting.audio_path).toBeUndefined();
    expect((await as(owner).get(`/api/meetings/${meeting.id}/audio`)).status).toBe(404);
  });
});

describe('Tâches', () => {
  let task;
  test('création avec acteur membre et échéance (17 h UTC)', async () => {
    const res = await as(owner).post('/api/tasks', {
      title: 'Préparer la démo', project_id: project.id, assignee_id: member.user.id, due_date: '2026-12-10', priority: 'haute',
    });
    expect(res.status).toBe(201);
    task = res.body.task;
    expect(task).toMatchObject({ assignee_id: member.user.id, assignee: 'Membre', priority: 'haute', status: 'todo', source: 'manual' });
    expect(new Date(task.due_date).toISOString()).toBe('2026-12-10T17:00:00.000Z');
  });

  test('acteur qui n\'est pas membre du projet → 400', async () => {
    const stranger = await register('Etranger');
    const res = await as(owner).post('/api/tasks', { title: 'X', project_id: project.id, assignee_id: stranger.user.id });
    expect(res.status).toBe(400);
  });

  test('l\'acteur la voit dans sa liste, la modifie et change son statut', async () => {
    expect((await as(member).get('/api/tasks')).body.tasks.map((t) => t.id)).toContain(task.id);
    const updated = await as(member).put(`/api/tasks/${task.id}`, { title: 'Préparer la démo client' });
    expect(updated.status).toBe(200);
    expect(updated.body.task.title).toBe('Préparer la démo client');
    const done = await as(member).patch(`/api/tasks/${task.id}/status`, { status: 'done' });
    expect(done.body.task.status).toBe('done');
    expect((await as(member).patch(`/api/tasks/${task.id}/status`, { status: 'fini' })).status).toBe(400);
  });

  test('suppression logique : disparaît des listes, reste en base', async () => {
    expect((await as(owner).delete(`/api/tasks/${task.id}`)).status).toBe(204);
    expect((await as(owner).get('/api/tasks')).body.tasks.map((t) => t.id)).not.toContain(task.id);
    expect((await query('SELECT is_active FROM tasks WHERE id = $1', [task.id])).rows[0].is_active).toBe(false);
    expect((await as(owner).put(`/api/tasks/${task.id}`, { title: 'Fantôme' })).status).toBe(404);
  });
});

describe('Tableau de bord et calendrier', () => {
  test('compteurs réels de l\'utilisateur', async () => {
    await as(owner).post('/api/tasks', { title: 'En retard', project_id: project.id, assignee_id: owner.user.id, due_date: '2020-01-15' });
    const res = await as(owner).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.my_open_tasks).toBeGreaterThanOrEqual(1);
    expect(res.body.my_overdue_tasks).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.active_projects).toBe('number');
  });

  test('calendrier du projet', async () => {
    const res = await as(owner).get(`/api/calendar?from=2026-11-30&to=2027-01-10&projectId=${project.id}`);
    expect(res.status).toBe(200);
    expect(res.body.meetings.map((m) => m.title)).toContain('Revue');
  });
});
