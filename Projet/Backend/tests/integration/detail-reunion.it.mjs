// tests/integration/detail-reunion.it.mjs
// Bloc 14 — Page de détail d'une réunion sur une VRAIE base PostgreSQL, par les vraies routes HTTP.
// Vérifie les jointures de GET /api/meetings/:id/details (décisions, tâches, alertes, risques,
// courriels) et l'envoi protégé de l'audio (Range, contrôle d'accès).
// Aucun appel à Gemini : l'API est remplacée (la mémoire vectorielle est simplement ignorée).
//
// Prérequis : base démarrée, migrations jusqu'à 011 appliquées.
// Lancer (depuis Projet/Backend) :   node tests/integration/detail-reunion.it.mjs
// Sur une autre base :               $env:DB_NAME='veridian_verif'; node tests/integration/detail-reunion.it.mjs

import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { GoogleGenerativeAI } from '@google/generative-ai';

GoogleGenerativeAI.prototype.getGenerativeModel = function () {
  return {
    embedContent: async () => { throw new Error('pas d\'appel à Gemini en test'); },
    generateContent: async () => { throw new Error('pas d\'appel à Gemini en test'); },
  };
};

const { default: app } = await import('../../app.js');
const { default: pool } = await import('../../src/config/db.js');
const { UPLOAD_DIR, ensureUploadDir } = await import('../../src/config/storage.js');
const { setMeetingAudio } = await import('../../src/models/meeting-detail.model.js');

const suffix = Math.random().toString(36).slice(2, 8);
let passed = 0;
const check = async (label, fn) => { await fn(); passed += 1; console.log(`  ✔ ${label}`); };
const register = async (name) => {
  const res = await request(app).post('/api/auth/register')
    .send({ name, email: `it-${name.toLowerCase()}-${suffix}@example.test`, password: 'motdepasse-test' });
  assert.equal(res.status, 201);
  return { token: res.body.token, user: res.body.user };
};
const as = (a) => ({ Authorization: `Bearer ${a.token}` });

const audioName = `it_audio_${suffix}.webm`;
const audioBytes = Buffer.from('0123456789ABCDEFGHIJ'); // 20 octets : de quoi tester Range

try {
  console.log(`Scénario bloc 14 (base « ${process.env.DB_NAME} »)`);
  const owner = await register('Organisatrice');
  const outsider = await register('Visiteur');

  const project = (await request(app).post('/api/projects').set(as(owner)).send({ name: `Détail IT ${suffix}` })).body.project;
  const meeting = (await request(app).post('/api/meetings').set(as(owner)).send({ projectId: project.id, title: 'Réunion détaillée' })).body.meeting;
  const earlier = (await request(app).post('/api/meetings').set(as(owner)).send({ projectId: project.id, title: 'Réunion précédente' })).body.meeting;

  await check('transcription saisie (sans analyse) puis relue dans le détail', async () => {
    const res = await request(app).post('/api/transcriptions/text').set(as(owner))
      .send({ meetingId: meeting.id, rawText: 'On a décidé d\'utiliser React.', autoAnalyze: false });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  // Données de l'analyse insérées directement : on teste ici les JOINTURES de la page
  const oldDecision = await pool.query(
    `INSERT INTO decisions (meeting_id, project_id, content) VALUES ($1, $2, 'Utiliser Vue.js') RETURNING id`,
    [earlier.id, project.id]);
  const newDecision = await pool.query(
    `INSERT INTO decisions (meeting_id, project_id, content) VALUES ($1, $2, 'Utiliser React') RETURNING id`,
    [meeting.id, project.id]);
  await pool.query(
    `INSERT INTO alerts (new_decision_id, conflict_decision_id, project_id, explanation, severity)
     VALUES ($1, $2, $3, 'React remplace Vue.js', 'high')`,
    [newDecision.rows[0].id, oldDecision.rows[0].id, project.id]);
  await pool.query(
    `INSERT INTO mtg_risks (project_id, meeting_id, kind, description, severity, mitigation)
     VALUES ($1, $2, 'echeance', 'Délai serré', 'medium', 'Prévoir une semaine de marge')`,
    [project.id, meeting.id]);
  await pool.query(
    `INSERT INTO mtg_notifications (meeting_id, user_id, email, subject, kind, status)
     VALUES ($1, $2, $3, 'Vos tâches', 'actor', 'logged')`,
    [meeting.id, owner.user.id, owner.user.email]);
  const task = (await request(app).post('/api/tasks').set(as(owner))
    .send({ title: 'Migrer vers React', meeting_id: meeting.id, assignee_id: owner.user.id, due_date: '2026-12-10' })).body.task;

  await check('détail complet : transcription, décision, tâche (acteur, date), alerte, risque, courriel', async () => {
    const res = await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(owner));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const b = res.body;
    assert.equal(b.meeting.title, 'Réunion détaillée');
    assert.equal(b.meeting.project_name, `Détail IT ${suffix}`);
    assert.ok(!('audio_path' in b.meeting));
    assert.equal(b.meeting.has_audio, false);
    assert.match(b.transcription.raw_text, /React/);
    assert.deepEqual(b.decisions.map((d) => d.content), ['Utiliser React']);
    assert.equal(b.tasks.length, 1);
    assert.equal(b.tasks[0].id, task.id);
    assert.equal(b.tasks[0].assignee, 'Organisatrice');
    assert.equal(new Date(b.tasks[0].due_date).toISOString(), '2026-12-10T17:00:00.000Z');
    assert.equal(b.alerts.length, 1);
    assert.equal(b.alerts[0].conflict_decision, 'Utiliser Vue.js');
    assert.equal(b.alerts[0].conflict_meeting_title, 'Réunion précédente');
    assert.equal(b.risks[0].mitigation, 'Prévoir une semaine de marge');
    assert.equal(b.notifications[0].status, 'logged');
  });

  await check('l\'alerte apparaît aussi dans la réunion dont la décision est contredite', async () => {
    const res = await request(app).get(`/api/meetings/${earlier.id}/details`).set(as(owner));
    assert.equal(res.body.alerts.length, 1);
  });

  await check('une tâche supprimée disparaît du détail', async () => {
    const extra = (await request(app).post('/api/tasks').set(as(owner)).send({ title: 'Temporaire', meeting_id: meeting.id })).body.task;
    await request(app).delete(`/api/tasks/${extra.id}`).set(as(owner));
    const res = await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(owner));
    assert.ok(!res.body.tasks.some((t) => t.id === extra.id));
  });

  ensureUploadDir();
  fs.writeFileSync(path.join(UPLOAD_DIR, audioName), audioBytes);
  await setMeetingAudio(meeting.id, audioName);

  await check('audio : envoyé au membre (type audio/webm), has_audio = true', async () => {
    const res = await request(app).get(`/api/meetings/${meeting.id}/audio`).set(as(owner))
      .buffer(true).parse((r, cb) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /audio\/webm/);
    assert.equal(res.body.length, audioBytes.length);
    const detail = await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(owner));
    assert.equal(detail.body.meeting.has_audio, true);
  });

  await check('audio : requête partielle (Range) → 206, pour avancer dans l\'enregistrement', async () => {
    const res = await request(app).get(`/api/meetings/${meeting.id}/audio`).set(as(owner)).set('Range', 'bytes=5-9')
      .buffer(true).parse((r, cb) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    assert.equal(res.status, 206);
    assert.equal(res.body.toString(), '56789');
  });

  await check('un non-membre reçoit 404 pour le détail ET pour l\'audio', async () => {
    assert.equal((await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(outsider))).status, 404);
    assert.equal((await request(app).get(`/api/meetings/${meeting.id}/audio`).set(as(outsider))).status, 404);
  });

  await check('sans jeton : 401', async () => {
    assert.equal((await request(app).get(`/api/meetings/${meeting.id}/audio`)).status, 401);
  });

  console.log(`\nRÉUSSI : ${passed} vérifications sur vraie base.`);
} catch (error) {
  console.error(`\nÉCHEC après ${passed} vérification(s) :`, error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(path.join(UPLOAD_DIR, audioName), { force: true });
  await pool.end();
}
