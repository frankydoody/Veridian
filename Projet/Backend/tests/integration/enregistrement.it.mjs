// tests/integration/enregistrement.it.mjs
// Bloc 20 — Envoi d'un enregistrement et transcription EN ARRIÈRE-PLAN, sur une vraie base,
// avec le VRAI Whisper et le vrai ffmpeg (seul Gemini est remplacé : aucune clé utilisée).
//
// Prérequis : base démarrée, migrations jusqu'à 012, Whisper et ffmpeg installés.
// Lancer (depuis Projet/Backend) :
//   node tests/integration/enregistrement.it.mjs
//       → génère 3 s de son avec ffmpeg : vérifie la chaîne (202, suivi, fin du traitement)
//   node tests/integration/enregistrement.it.mjs <fichier-audio> <mot attendu> [langue]
//       → vérifie en plus que le texte transcrit contient le mot attendu
//         ex. : node tests/integration/enregistrement.it.mjs ma-voix.wav budget fr
// Sur une autre base : $env:DB_NAME='veridian_verif' avant la commande.

import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { GoogleGenerativeAI } from '@google/generative-ai';

const [audioArg, expectedWord, language] = process.argv.slice(2);
if (language) process.env.WHISPER_LANGUAGE = language;

GoogleGenerativeAI.prototype.getGenerativeModel = function () {
  return {
    embedContent: async () => { throw new Error('pas d\'appel à Gemini en test'); },
    generateContent: async () => { throw new Error('pas d\'appel à Gemini en test'); },
  };
};

const { default: app } = await import('../../app.js');
const { default: pool } = await import('../../src/config/db.js');
const { resetInterruptedProcessing } = await import('../../src/models/processing.model.js');

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fichier à envoyer : celui donné en argument, sinon 3 s de son générées par ffmpeg
let audioFile = audioArg;
let tempDir = null;
if (!audioFile) {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'veridian-it-'));
  audioFile = path.join(tempDir, 'ton.wav');
  const gen = spawnSync(process.env.FFMPEG_COMMAND || 'ffmpeg',
    ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', audioFile]);
  if (gen.status !== 0) {
    console.error('ffmpeg introuvable : impossible de générer un son de test.');
    process.exit(1);
  }
}
const contentType = audioFile.endsWith('.webm') ? 'audio/webm' : audioFile.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';

try {
  console.log(`Scénario bloc 20 (base « ${process.env.DB_NAME} », fichier ${path.basename(audioFile)}, langue ${process.env.WHISPER_LANGUAGE || 'fr'})`);
  const owner = await register('Enregistreuse');
  const outsider = await register('Curieux');
  const project = (await request(app).post('/api/projects').set(as(owner)).send({ name: `Enregistrement IT ${suffix}` })).body.project;
  const meeting = (await request(app).post('/api/meetings').set(as(owner)).send({ projectId: project.id, title: 'Réunion enregistrée' })).body.meeting;

  await check('un non-membre ne peut pas envoyer d\'audio : 404', async () => {
    const res = await request(app).post('/api/transcriptions/upload').set(as(outsider))
      .field('meetingId', meeting.id).attach('audio', audioFile, { contentType });
    assert.equal(res.status, 404);
  });

  await check('type refusé : 415', async () => {
    const res = await request(app).post('/api/transcriptions/upload').set(as(owner))
      .field('meetingId', meeting.id).attach('audio', Buffer.from('<html>'), { filename: 'x.html', contentType: 'text/html' });
    assert.equal(res.status, 415);
  });

  let started;
  await check('envoi : réponse 202 IMMÉDIATE (Whisper ne bloque plus la requête)', async () => {
    started = Date.now();
    const res = await request(app).post('/api/transcriptions/upload').set(as(owner))
      .field('meetingId', meeting.id).field('autoAnalyze', 'false').attach('audio', audioFile, { contentType });
    const elapsed = Date.now() - started;
    assert.equal(res.status, 202, JSON.stringify(res.body));
    assert.equal(res.body.transcription_status, 'processing');
    assert.ok(elapsed < 5000, `réponse en ${elapsed} ms`);
  });

  await check('pendant le traitement : un second envoi est refusé (409)', async () => {
    const res = await request(app).post('/api/transcriptions/upload').set(as(owner))
      .field('meetingId', meeting.id).attach('audio', audioFile, { contentType });
    assert.equal(res.status, 409);
  });

  let final;
  await check('suivi : l\'état passe de « processing » à un état final', async () => {
    const deadline = Date.now() + 10 * 60 * 1000;
    do {
      await sleep(2000);
      final = (await request(app).get(`/api/meetings/${meeting.id}/analysis`).set(as(owner))).body;
    } while (final.transcription_status === 'processing' && Date.now() < deadline);
    console.log(`      (Whisper : ${Math.round((Date.now() - started) / 1000)} s, état « ${final.transcription_status} »${final.transcription_error ? ` : ${final.transcription_error}` : ''})`);
    assert.ok(['done', 'error'].includes(final.transcription_status));
  });

  if (expectedWord) {
    await check(`transcription réelle : contient « ${expectedWord} »`, async () => {
      assert.equal(final.transcription_status, 'done', final.transcription_error);
      const detail = (await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(owner))).body;
      console.log(`      Texte : « ${detail.transcription.raw_text} »`);
      assert.match(detail.transcription.raw_text.toLowerCase(), new RegExp(expectedWord.toLowerCase()));
    });
  }

  await check('l\'audio est conservé et lisible dans la page de la réunion', async () => {
    const detail = (await request(app).get(`/api/meetings/${meeting.id}/details`).set(as(owner))).body;
    assert.equal(detail.meeting.has_audio, true);
    const audio = await request(app).get(`/api/meetings/${meeting.id}/audio`).set(as(owner));
    assert.equal(audio.status, 200);
  });

  await check('redémarrage du serveur : un traitement resté « en cours » passe en erreur', async () => {
    await pool.query(`UPDATE meetings SET transcription_status = 'processing' WHERE id = $1`, [meeting.id]);
    const reset = await resetInterruptedProcessing();
    assert.ok(reset.transcriptions >= 1);
    const state = (await request(app).get(`/api/meetings/${meeting.id}/analysis`).set(as(owner))).body;
    assert.equal(state.transcription_status, 'error');
    assert.match(state.transcription_error, /redémarré/);
  });

  console.log(`\nRÉUSSI : ${passed} vérifications (vraie base, vrai Whisper).`);
} catch (error) {
  console.error(`\nÉCHEC après ${passed} vérification(s) :`, error.message);
  process.exitCode = 1;
} finally {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  await pool.end();
}
