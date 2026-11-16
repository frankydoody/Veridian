import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Bloc 20 — service Whisper. `spawn` est remplacé : aucun vrai programme n'est lancé.
// Chaque appel à spawn consomme le prochain « scénario » de la file.
const scenarios = [];
const spawned = [];
const spawn = jest.fn((command, args) => {
  const scenario = scenarios.shift() ?? {};
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn(() => setImmediate(() => proc.emit('close', null)));
  spawned.push({ command, args, proc });
  setImmediate(() => {
    if (scenario.error) { proc.emit('error', scenario.error); return; }
    if (scenario.hang) return; // ne se termine jamais (délai dépassé)
    if (scenario.stderr) proc.stderr.emit('data', Buffer.from(scenario.stderr));
    if (scenario.writeJson) fs.writeFileSync(scenario.writeJson.path, JSON.stringify(scenario.writeJson.content));
    proc.emit('close', scenario.code ?? 0);
  });
  return proc;
});
jest.unstable_mockModule('child_process', () => ({ spawn }));

const { transcribeAudio, resetFfmpegCheck } = await import('../../src/services/whisper.service.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veridian-whisper-'));
const audio = path.join(dir, 'reunion.webm');
const json = path.join(dir, 'reunion.json');
const enoent = () => Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });

beforeEach(() => {
  scenarios.length = 0;
  spawned.length = 0;
  resetFfmpegCheck();
  fs.rmSync(json, { force: true });
});
afterEach(() => { delete process.env.WHISPER_TIMEOUT_MIN; });

describe('transcribeAudio', () => {
  test('succès : renvoie le texte et supprime le JSON temporaire', async () => {
    scenarios.push({ code: 0 }, { code: 0, writeJson: { path: json, content: { text: '  Bonjour à tous.  ' } } });
    await expect(transcribeAudio(audio)).resolves.toBe('Bonjour à tous.');
    expect(fs.existsSync(json)).toBe(false);
    expect(spawned[1].args).toEqual(expect.arrayContaining(['--language', 'fr', '--output_format', 'json']));
  });

  test('ffmpeg introuvable : message actionnable, Whisper n\'est pas lancé', async () => {
    scenarios.push({ error: enoent() });
    await expect(transcribeAudio(audio)).rejects.toThrow(/ffmpeg est introuvable.*winget install Gyan\.FFmpeg/);
    expect(spawned).toHaveLength(1);
  });

  test('Whisper introuvable : message actionnable', async () => {
    scenarios.push({ code: 0 }, { error: enoent() });
    await expect(transcribeAudio(audio)).rejects.toThrow(/Whisper est introuvable.*pip install openai-whisper/);
  });

  test('échec de Whisper : la dernière ligne d\'erreur est donnée, le JSON est nettoyé', async () => {
    fs.writeFileSync(json, '{}'); // reste d'un essai précédent
    scenarios.push({ code: 0 }, { code: 1, stderr: 'Traceback...\nRuntimeError: Failed to load audio\n' });
    await expect(transcribeAudio(audio)).rejects.toThrow('Whisper a échoué (code 1) : RuntimeError: Failed to load audio');
    expect(fs.existsSync(json)).toBe(false);
  });

  test('délai dépassé : le processus est arrêté et le message indique quoi faire', async () => {
    process.env.WHISPER_TIMEOUT_MIN = String(50 / 60000); // 50 ms
    scenarios.push({ code: 0 }, { hang: true });
    await expect(transcribeAudio(audio)).rejects.toThrow(/dépassé.*WHISPER_TIMEOUT_MIN/);
    expect(spawned[1].proc.kill).toHaveBeenCalled();
  });

  test('ffmpeg n\'est vérifié qu\'une fois tant qu\'il est trouvé', async () => {
    scenarios.push({ code: 0 }, { code: 0, writeJson: { path: json, content: { text: 'a' } } });
    await transcribeAudio(audio);
    scenarios.push({ code: 0, writeJson: { path: json, content: { text: 'b' } } });
    await expect(transcribeAudio(audio)).resolves.toBe('b');
    expect(spawned).toHaveLength(3); // ffmpeg, whisper, whisper
  });
});
