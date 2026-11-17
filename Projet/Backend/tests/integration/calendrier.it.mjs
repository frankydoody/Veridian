// tests/integration/calendrier.it.mjs
// Bloc 16 — Calendrier sur une VRAIE base PostgreSQL, par les vraies routes HTTP :
// date prévue d'une réunion, plage de dates (bornes incluses), filtre par projet,
// contrôle d'accès (un non-membre ne voit rien, 404 sur le projet d'un autre).
//
// Prérequis : base démarrée, migrations jusqu'à 014 appliquées.
// Lancer (depuis Projet/Backend) :   node tests/integration/calendrier.it.mjs
// Sur une autre base :               $env:DB_NAME='veridian_verif'; node tests/integration/calendrier.it.mjs

import 'dotenv/config';
import assert from 'node:assert/strict';
import request from 'supertest';

const { default: app } = await import('../../app.js');
const { default: pool } = await import('../../src/config/db.js');

const suffix = Math.random().toString(36).slice(2, 8);
const RANGE = { from: '2026-11-30', to: '2027-01-10' }; // grille de décembre 2026

let passed = 0;
const check = async (label, fn) => { await fn(); passed += 1; console.log(`  ✔ ${label}`); };
const register = async (name) => {
  const res = await request(app).post('/api/auth/register')
    .send({ name, email: `it-cal-${name.toLowerCase()}-${suffix}@example.test`, password: 'motdepasse-test' });
  assert.equal(res.status, 201);
  return { token: res.body.token, user: res.body.user };
};
const as = (a) => ({ Authorization: `Bearer ${a.token}` });
const calendar = (account, query) => request(app).get('/api/calendar').query(query).set(as(account));
const titles = (list) => list.map((e) => e.title).sort();

try {
  console.log(`Scénario bloc 16 (base « ${process.env.DB_NAME} »)`);
  const owner = await register('Organisatrice');
  const member = await register('Membre');
  const outsider = await register('Externe');

  const shared = (await request(app).post('/api/projects').set(as(owner)).send({ name: `Partagé ${suffix}` })).body.project;
  const privateProject = (await request(app).post('/api/projects').set(as(owner)).send({ name: `Privé ${suffix}` })).body.project;
  await request(app).post(`/api/projects/${shared.id}/members`).set(as(owner)).send({ email: member.user.email });

  const meeting = async (project, title, scheduledAt) => {
    const res = await request(app).post('/api/meetings').set(as(owner)).send({ projectId: project.id, title, scheduledAt });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.meeting;
  };
  const task = async (project, title, dueDate, assigneeId) => {
    const res = await request(app).post('/api/tasks').set(as(owner))
      .send({ title, project_id: project.id, due_date: dueDate, assignee_id: assigneeId });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.task;
  };

  await check('réunion avec date prévue : enregistrée et renvoyée par la création', async () => {
    const m = await meeting(shared, 'Revue planifiée', '2026-12-05T15:00:00.000Z');
    assert.equal(new Date(m.scheduled_at).toISOString(), '2026-12-05T15:00:00.000Z');
  });
  await meeting(privateProject, 'Réunion privée', '2026-12-20T14:00:00.000Z');
  await meeting(shared, 'Marge avant', '2026-11-29T12:00:00.000Z');  // la veille de la grille : renvoyée (marge de fuseau)
  await meeting(shared, 'Trop tôt', '2026-11-27T12:00:00.000Z');     // hors marge
  await meeting(shared, 'Sans date');                                 // placée à sa date de création (aujourd'hui)

  await task(shared, 'Maquettes', '2026-12-10', member.user.id);
  await task(shared, 'Dernier jour', '2027-01-10');
  await task(shared, 'Lendemain', '2027-01-11');
  await task(privateProject, 'Tâche privée', '2026-12-21');

  await check('date prévue invalide → 400', async () => {
    const res = await request(app).post('/api/meetings').set(as(owner))
      .send({ projectId: shared.id, title: 'Mauvaise date', scheduledAt: 'bientôt' });
    assert.equal(res.status, 400);
  });

  await check('propriétaire, tous ses projets : réunions et échéances de la plage (bornes incluses)', async () => {
    const res = await calendar(owner, RANGE);
    assert.equal(res.status, 200);
    assert.deepEqual(titles(res.body.meetings), ['Marge avant', 'Revue planifiée', 'Réunion privée']);
    assert.deepEqual(titles(res.body.tasks), ['Dernier jour', 'Maquettes', 'Tâche privée']);
    const maquettes = res.body.tasks.find((t) => t.title === 'Maquettes');
    assert.equal(maquettes.assignee, 'Membre');
    assert.equal(maquettes.due_date.slice(0, 10), '2026-12-10');
  });

  await check('date d\'une réunion = prévue, sinon création (réunion sans date visible aujourd\'hui)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await calendar(owner, { from: today, to: today });
    const sansDate = res.body.meetings.find((m) => m.title === 'Sans date');
    assert.ok(sansDate, 'la réunion sans date doit apparaître le jour de sa création');
    assert.equal(sansDate.scheduled_at, null);
  });

  await check('filtre par projet : seulement ce projet', async () => {
    const res = await calendar(owner, { ...RANGE, projectId: privateProject.id });
    assert.equal(res.status, 200);
    assert.deepEqual(titles(res.body.meetings), ['Réunion privée']);
    assert.deepEqual(titles(res.body.tasks), ['Tâche privée']);
  });

  await check('membre : voit le projet partagé, jamais le projet privé', async () => {
    const res = await calendar(member, RANGE);
    assert.deepEqual(titles(res.body.meetings), ['Marge avant', 'Revue planifiée']);
    assert.deepEqual(titles(res.body.tasks), ['Dernier jour', 'Maquettes']);
  });

  await check('non-membre : calendrier vide, et 404 sur le projet d\'un autre', async () => {
    const all = await calendar(outsider, RANGE);
    assert.equal(all.status, 200);
    assert.equal(all.body.meetings.length + all.body.tasks.length, 0);
    const other = await calendar(outsider, { ...RANGE, projectId: shared.id });
    assert.equal(other.status, 404);
  });

  await check('paramètres invalides → 400 (plage manquante, trop longue, projet mal formé)', async () => {
    assert.equal((await calendar(owner, { from: '2026-12-01' })).status, 400);
    assert.equal((await calendar(owner, { from: '2026-01-01', to: '2026-12-31' })).status, 400);
    assert.equal((await calendar(owner, { ...RANGE, projectId: 'abc' })).status, 400);
  });

  await check('sans jeton → 401 ; aucune donnée sensible dans la réponse', async () => {
    assert.equal((await request(app).get('/api/calendar').query(RANGE)).status, 401);
    const res = await calendar(owner, RANGE);
    assert.ok(!JSON.stringify(res.body).includes('password'));
    assert.ok(!JSON.stringify(res.body).includes('@example.test'));
  });

  console.log(`\n${passed} vérifications réussies.`);
} catch (error) {
  console.error('\n✘ Échec :', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
