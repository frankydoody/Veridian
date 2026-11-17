// tests/integration/formulaires.it.mjs
// Bloc 13 — Formulaires et membres sur une VRAIE base PostgreSQL, par les vraies routes HTTP.
// Les mocks des tests unitaires ne voient pas les erreurs SQL (voir BUG-02) : ce scénario,
// lui, exécute réellement chaque requête nouvelle (membres, tâche modifiée, suppression logique).
//
// Prérequis : base démarrée, migrations jusqu'à 011 appliquées (start.ps1 / start.sh le font).
// Lancer (depuis Projet/Backend) :   node tests/integration/formulaires.it.mjs
// Sur une autre base que celle du .env :  $env:DB_NAME='veridian_verif'; node tests/integration/formulaires.it.mjs
//
// Le script crée trois comptes « it-…@example.test » et un projet de test dans la base visée.

import 'dotenv/config';
import assert from 'node:assert/strict';
import request from 'supertest';

const { default: app } = await import('../../app.js');
const { default: pool } = await import('../../src/config/db.js');

const suffix = Math.random().toString(36).slice(2, 8);
let passed = 0;
const check = async (label, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${label}`);
};

const register = async (name) => {
  const res = await request(app).post('/api/auth/register')
    .send({ name, email: `it-${name.toLowerCase()}-${suffix}@example.test`, password: 'motdepasse-test' });
  assert.equal(res.status, 201, `inscription de ${name} : ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
};
const as = (account) => ({ Authorization: `Bearer ${account.token}` });

try {
  console.log(`Scénario bloc 13 (base « ${process.env.DB_NAME} »)`);
  const owner = await register('Proprietaire');
  const member = await register('Membre');
  const outsider = await register('Externe');

  let projectId;
  await check('créer un projet (formulaire) : 201, créateur propriétaire', async () => {
    const res = await request(app).post('/api/projects').set(as(owner))
      .send({ name: `  Projet IT ${suffix}  `, description: 'Scénario formulaires' });
    assert.equal(res.status, 201);
    assert.equal(res.body.project.name, `Projet IT ${suffix}`);
    projectId = res.body.project.id;
  });

  await check('ajouter un membre par courriel (insensible à la casse) : 201', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/members`).set(as(owner))
      .send({ email: member.user.email.toUpperCase() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.member.id, member.user.id);
    assert.ok(!('password_hash' in res.body.member));
  });

  await check('ajouter deux fois la même personne : 409', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/members`).set(as(owner))
      .send({ email: member.user.email });
    assert.equal(res.status, 409);
  });

  await check('liste des membres : propriétaire en premier, aucun password_hash', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/members`).set(as(member));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.members.map((m) => m.role), ['owner', 'member']);
    assert.doesNotMatch(JSON.stringify(res.body), /password/);
  });

  await check('un non-membre reçoit 404 (membres, projet, réunion)', async () => {
    assert.equal((await request(app).get(`/api/projects/${projectId}/members`).set(as(outsider))).status, 404);
    assert.equal((await request(app).get(`/api/projects/${projectId}`).set(as(outsider))).status, 404);
    const meeting = await request(app).post('/api/meetings').set(as(outsider))
      .send({ projectId, title: 'Intrusion' });
    assert.equal(meeting.status, 404);
  });

  await check('un membre non propriétaire ne peut pas ajouter de membre : 403', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/members`).set(as(member))
      .send({ email: outsider.user.email });
    assert.equal(res.status, 403);
  });

  let meetingId;
  await check('créer une réunion (formulaire) : 201', async () => {
    const res = await request(app).post('/api/meetings').set(as(member))
      .send({ projectId, title: 'Réunion de lancement IT' });
    assert.equal(res.status, 201);
    meetingId = res.body.meeting.id;
  });

  let taskId;
  await check('créer une tâche avec un acteur NON membre : 400', async () => {
    const res = await request(app).post('/api/tasks').set(as(owner))
      .send({ title: 'Tâche refusée', project_id: projectId, assignee_id: outsider.user.id });
    assert.equal(res.status, 400);
  });

  await check('créer une tâche liée à la réunion, acteur membre, échéance : 201', async () => {
    const res = await request(app).post('/api/tasks').set(as(owner))
      .send({ title: 'Préparer les maquettes', meeting_id: meetingId, assignee_id: member.user.id,
              priority: 'haute', due_date: '2026-12-01' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.task.project_id, projectId); // projet déduit de la réunion
    assert.equal(res.body.task.assignee, 'Membre');
    assert.equal(new Date(res.body.task.due_date).toISOString(), '2026-12-01T17:00:00.000Z');
    taskId = res.body.task.id;
  });

  await check('la tâche est visible par l\'acteur, invisible pour un externe', async () => {
    const mine = await request(app).get('/api/tasks').set(as(member));
    assert.ok(mine.body.tasks.some((t) => t.id === taskId));
    const theirs = await request(app).get('/api/tasks').set(as(outsider));
    assert.ok(!theirs.body.tasks.some((t) => t.id === taskId));
    const put = await request(app).put(`/api/tasks/${taskId}`).set(as(outsider)).send({ title: 'Piratée' });
    assert.equal(put.status, 404);
  });

  await check('modifier la tâche (titre, priorité, acteur retiré) : seulement les champs envoyés', async () => {
    const res = await request(app).put(`/api/tasks/${taskId}`).set(as(member))
      .send({ title: 'Maquettes finales', priority: 'basse', assignee_id: null });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.task.title, 'Maquettes finales');
    assert.equal(res.body.task.priority, 'basse');
    assert.equal(res.body.task.assignee_id, null);
    assert.equal(res.body.task.assignee, null);
    assert.equal(res.body.task.meeting_id, meetingId); // inchangé
  });

  await check('changer le statut renvoie la tâche complète (nom du projet inclus)', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}/status`).set(as(member)).send({ status: 'in_progress' });
    assert.equal(res.status, 200);
    assert.equal(res.body.task.project_name, `Projet IT ${suffix}`);
  });

  await check('suppression par un membre non créateur : 403 ; par le créateur : 204 (logique)', async () => {
    assert.equal((await request(app).delete(`/api/tasks/${taskId}`).set(as(member))).status, 403);
    assert.equal((await request(app).delete(`/api/tasks/${taskId}`).set(as(owner))).status, 204);
    const list = await request(app).get('/api/tasks').set(as(owner));
    assert.ok(!list.body.tasks.some((t) => t.id === taskId));
    const row = await pool.query('SELECT is_active FROM tasks WHERE id = $1', [taskId]);
    assert.equal(row.rows[0].is_active, false); // la ligne existe toujours
  });

  await check('retirer un membre puis le réajouter (réactivation de la même ligne)', async () => {
    assert.equal((await request(app).delete(`/api/projects/${projectId}/members/${member.user.id}`).set(as(owner))).status, 200);
    assert.equal((await request(app).get(`/api/projects/${projectId}`).set(as(member))).status, 404);
    const again = await request(app).post(`/api/projects/${projectId}/members`).set(as(owner))
      .send({ email: member.user.email });
    assert.equal(again.status, 201);
    const rows = await pool.query(
      'SELECT COUNT(*)::int AS n FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, member.user.id]
    );
    assert.equal(rows.rows[0].n, 1);
  });

  await check('le propriétaire ne peut pas être retiré : 400', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}/members/${owner.user.id}`).set(as(owner));
    assert.equal(res.status, 400);
  });

  console.log(`\nRÉUSSI : ${passed} vérifications sur vraie base.`);
} catch (error) {
  console.error(`\nÉCHEC après ${passed} vérification(s) :`, error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
