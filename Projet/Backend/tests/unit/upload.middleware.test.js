import { describe, test, expect, afterEach } from '@jest/globals';
import fs from 'fs';
import express from 'express';
import request from 'supertest';
import {
  uploadAudio, baseMimeType, audioExtensionFor, maxAudioBytes,
} from '../../src/middlewares/upload.middleware.js';

// Bloc 20 — réception d'un fichier audio : types, extension, taille, erreurs claires.
const saved = [];
const app = express();
app.post('/upload', uploadAudio, (req, res) => {
  if (req.file) saved.push(req.file.path);
  res.status(200).json({ file: req.file ? { path: req.file.path, size: req.file.size } : null });
});

afterEach(() => {
  delete process.env.MAX_AUDIO_MB;
  while (saved.length) fs.rmSync(saved.pop(), { force: true });
});

describe('types audio', () => {
  test('baseMimeType retire les paramètres du type', () => {
    expect(baseMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(baseMimeType(' Audio/OGG ; codecs=opus')).toBe('audio/ogg');
    expect(baseMimeType(undefined)).toBe('');
  });

  test('extension tirée du type vérifié, jamais du nom de fichier', () => {
    expect(audioExtensionFor('audio/webm;codecs=opus')).toBe('.webm');
    expect(audioExtensionFor('audio/mpeg')).toBe('.mp3');
    expect(audioExtensionFor('audio/x-wav')).toBe('.wav');
    expect(audioExtensionFor('audio/mp4')).toBe('.m4a');
    expect(audioExtensionFor('text/html')).toBeNull();
    expect(audioExtensionFor('application/x-msdownload')).toBeNull();
  });

  test('taille maximale : 200 Mo par défaut, configurable', () => {
    expect(maxAudioBytes()).toBe(200 * 1024 * 1024);
    process.env.MAX_AUDIO_MB = '5';
    expect(maxAudioBytes()).toBe(5 * 1024 * 1024);
    process.env.MAX_AUDIO_MB = 'abc';
    expect(maxAudioBytes()).toBe(200 * 1024 * 1024);
  });
});

describe('uploadAudio', () => {
  test('enregistrement du navigateur (audio/webm;codecs=opus) accepté, nom aléatoire en .webm', async () => {
    const res = await request(app).post('/upload')
      .attach('audio', Buffer.from('donnees audio'), { filename: 'piege.html', contentType: 'audio/webm;codecs=opus' });
    expect(res.status).toBe(200);
    expect(res.body.file.path).toMatch(/audio_\d+_[0-9a-f]{16}\.webm$/);
    expect(res.body.file.path).not.toMatch(/piege/);
  });

  test('type refusé → 415 avec la liste des formats acceptés (et non 500)', async () => {
    const res = await request(app).post('/upload')
      .attach('audio', Buffer.from('<script>'), { filename: 'page.html', contentType: 'text/html' });
    expect(res.status).toBe(415);
    expect(res.body.message).toMatch(/webm, ogg, mp3, wav, m4a/);
  });

  test('fichier trop gros → 413 avec la limite', async () => {
    process.env.MAX_AUDIO_MB = '0.0001'; // environ 100 octets
    const res = await request(app).post('/upload')
      .attach('audio', Buffer.alloc(5000), { filename: 'long.wav', contentType: 'audio/wav' });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/trop volumineux/);
  });
});
