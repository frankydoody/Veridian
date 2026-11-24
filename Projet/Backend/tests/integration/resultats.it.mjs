// tests/integration/resultats.it.mjs
// Bloc 21 — Résultats de l'analyse, relance, « Mes tâches » et compteurs du tableau de bord,
// sur une VRAIE base PostgreSQL, par les vraies routes HTTP. L'IA est simulée (aucune clé utilisée).
//
// Prérequis : base démarrée, migrations jusqu'à 013 appliquées.
// Lancer (depuis Projet/Backend) :   node tests/integration/resultats.it.mjs
// Sur une autre base :               $env:DB_NAME='veridian_verif'; node tests/integration/resultats.it.mjs

import 'dotenv/config';
import assert from 'node:assert/strict';
import request from 'supertest';
import { GoogleGenerativeAI } from '@google/generative-ai';

const suffix = Math.random().toString(36).slice(2, 8);
const EXISTING = `Atlas IT ${suffix}`;
const CREATED = `Nouveau projet IT ${suffix}`;
const ACTOR = `Actrice${suffix}`;
let analyses = 0;

// IA simulée : un projet existant, un projet nouveau, une tâche en retard, une à venir
GoogleGenerativeAI.prototype.getGenerativeModel = function () {
  return {
    embedContent: async () => { throw new Error('pas d\'embeddings en test'); },
    generateContent: async (prompt) => {
      let out = {};
      if (prompt.includes('TRANSCRIPTION :')) {
        analyses += 1;
        out = {
          projects: [{ name: EXISTING }, { name: CREATED, description: 'Créé par la réunion' }],
          decisions: [{ project: EXISTING, content: 'Utiliser React Native', confidence: 90 }],
          tasks: [
            { project: EXISTING, title: 'Prototype mobile', assignee: ACTOR, priority: 'haute', dueDate: '2020-01-15' },
            { project: CREATED, title: 'Cadrer le nouveau projet', assignee: ACTOR, priority: 'moyenne', dueDate: '2099-06-01' },
          ],
        };
      } else if (prompt.includes('chef de projet')) {
        out = [];
      }
      return { response: { text: () => JSON.stringify(out) } };
    },
  };
};

const { default: app } = await import('../../app.js');
const { default: pool } = await import('../../src/config/db.js');

let passed = 0;
const check = async (label, fn) => { await fn(); passed += 1; console.log(`  ✔ ${label}`); };
const register = async (name) => {
  const res = await request(app).post('/api/auth/register')
    .send({ name, email: `it-${name.toLowerCase()}-${suffix}@example.test`, password: 'motdepasse-test' });
  assert.equal(res.status, 201);
  return { token: res.body.token, user: res.body.user };
};
const as = (a) => ({ Authorization: `Bearer ${a.token}` });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitAnalysis = async (account, meetingId) => {
  for (let i = 0; i < 60; i += 1) {
    const s = (await request(app).get(`/api/meetings/${meetingId}/analysis`).set(as(account))).body;
    if (s.analysis_status !== 'processing') return s;
    await sleep(500);
  }
  throw new Error('analyse trop longue');
};

try {
  console.log(`Scénario bloc 21 (base « ${process.env.DB_NAME} »)`);
  const owner = await register('Organisateur');
  const actor = await register(ACTOR);
  const outsider = await register('Externe');

  const project = (await request(app).post('/api/projects').set(as(owner)).send({ name: EXISTING })).body.project;
  await request(app).post(`/api/projects/${project.id}/members`).set(as(owner)).send({ email: actor.user.email });
  const meeting = (await request(app).post('/api/meetings').set(as(owner)).send({ projectId: project.id, title: 'Revue IT' })).body.meeting;

  await check('texte collé → analyse en arrière-plan → terminée', async () => {
    const res = await request(app).post('/api/transcriptions/text').set(as(owner))
      .send({ meetingId: meeting.id, rawText: `${ACTOR} fera le prototype mobile. On lance un nouveau projet.` });
    assert.equal(res.status, 201);
    const state = await waitAnalysis(owner, meeting.id);
    assert.equal(state.analysis_status, 'done', state.analysis_error);
    assert.equal(state.tasks.length, 2);
  });

  await check('détail : projet existant et projet NOUVEAU (créé par cette réunion)', async () => {
    const d = (await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(owner))).body;
    const byName = Object.fromEntries(d.projects.map((p) => [p.name, p.is_new]));
    assert.equal(byName[EXISTING], false);
    assert.equal(byName[CREATED], true);
  });

  await check('l\'actrice ne voit pas le nom d\'un projet dont elle n\'est pas membre', async () => {
    // Elle a été ajoutée au projet NOUVEAU (règle du bloc 19) : elle voit les deux.
    const d = (await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(actor))).body;
    assert.equal(d.projects.length, 2);
    // Retirée du nouveau projet, elle ne le voit plus dans la réunion
    const created = d.projects.find((p) => p.name === CREATED);
    await request(app).delete(`/api/projects/${created.id}/members/${actor.user.id}`).set(as(owner));
    const after = (await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(actor))).body;
    assert.deepEqual(after.projects.map((p) => p.name), [EXISTING]);
    await request(app).post(`/api/projects/${created.id}/members`).set(as(owner)).send({ email: actor.user.email });
  });

  // L'analyse remplace une échéance passée par une date estimée (une tâche neuve ne peut pas être
  // déjà en retard) : on simule le temps qui passe en reculant l'échéance directement en base.
  await pool.query(
    `UPDATE tasks SET due_date = '2020-01-15T17:00:00Z' WHERE meeting_id = $1 AND title = 'Prototype mobile'`,
    [meeting.id]);

  await check('tableau de bord de l\'actrice : 2 tâches ouvertes dont 1 en retard', async () => {
    const d = (await request(app).get('/api/dashboard').set(as(actor))).body;
    assert.equal(d.my_open_tasks, 2);
    assert.equal(d.my_overdue_tasks, 1);
    assert.equal(d.upcoming_tasks.length, 2);
    assert.equal(d.upcoming_tasks[0].title, 'Prototype mobile');
    assert.equal(d.upcoming_tasks[0].overdue, true);
    assert.equal(d.upcoming_tasks[1].overdue, false);
  });

  await check('tableau de bord du propriétaire : 1 tâche en retard dans ses projets, 0 alerte', async () => {
    const d = (await request(app).get('/api/dashboard').set(as(owner))).body;
    assert.equal(d.project_overdue_tasks, 1);
    assert.equal(d.open_alerts, 0);
    assert.equal(d.active_projects, 2);
    assert.ok(d.meetings_this_month >= 1);
    assert.equal(typeof d.my_open_tasks, 'number'); // et non une chaîne (COUNT = bigint)
  });

  await check('une tâche terminée n\'est plus comptée en retard', async () => {
    const d = (await request(app).get('/api/dashboard').set(as(actor))).body;
    await request(app).patch(`/api/tasks/${d.upcoming_tasks[0].id}/status`).set(as(actor)).send({ status: 'done' });
    const after = (await request(app).get('/api/dashboard').set(as(actor))).body;
    assert.equal(after.my_overdue_tasks, 0);
    assert.equal(after.my_open_tasks, 1);
  });

  await check('alertes ouvertes comptées, puis décomptées une fois résolues', async () => {
    const decisions = await pool.query(
      `INSERT INTO decisions (meeting_id, project_id, content) VALUES ($1, $2, 'A'), ($1, $2, 'B') RETURNING id`,
      [meeting.id, project.id]);
    const alert = await pool.query(
      `INSERT INTO alerts (new_decision_id, conflict_decision_id, project_id, explanation) VALUES ($1, $2, $3, 'test') RETURNING id`,
      [decisions.rows[0].id, decisions.rows[1].id, project.id]);
    assert.equal((await request(app).get('/api/dashboard').set(as(owner))).body.open_alerts, 1);
    await request(app).patch(`/api/alerts/${alert.rows[0].id}/resolve`).set(as(owner));
    assert.equal((await request(app).get('/api/dashboard').set(as(owner))).body.open_alerts, 0);
  });

  await check('relancer l\'analyse : 202, puis résultat remplacé (pas de doublon)', async () => {
    const res = await request(app).post(`/api/meetings/${meeting.id}/analyze`).set(as(owner));
    assert.equal(res.status, 202);
    const state = await waitAnalysis(owner, meeting.id);
    assert.equal(state.analysis_status, 'done');
    assert.equal(state.tasks.length, 2);
    assert.equal(analyses, 2);
    const d = (await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(owner))).body;
    assert.equal(d.projects.filter((p) => p.name === CREATED).length, 1); // pas de second « nouveau projet »
  });

  await check('un externe : compteurs à zéro, aucune donnée des autres', async () => {
    const d = (await request(app).get('/api/dashboard').set(as(outsider))).body;
    assert.equal(d.active_projects, 0);
    assert.equal(d.project_overdue_tasks, 0);
    assert.equal(d.upcoming_tasks.length, 0);
    assert.equal((await request(app).post(`/api/meetings/${meeting.id}/analyze`).set(as(outsider))).status, 404);
  });

  console.log(`\nRÉUSSI : ${passed} vérifications sur vraie base.`);
} catch (error) {
  console.error(`\nÉCHEC après ${passed} vérification(s) :`, error.message,
    'actual' in error ? `(obtenu : ${JSON.stringify(error.actual)}, attendu : ${JSON.stringify(error.expected)})` : '');
  process.exitCode = 1;
} finally {
  await pool.end();
}
