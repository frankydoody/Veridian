// scripts/verifier.js — Bloc 18 : vérifie que l'installation est complète et utilisable.
//
//   npm run verifier                   (depuis Projet/Backend)
//   npm run verifier -- --sans-ia      sans appeler Gemini
//   npm run verifier -- --sans-whisper sans contrôler Whisper ni ffmpeg
//
// Contrôle : .env, base joignable, extension vector, migrations appliquées, clé Gemini
// (un très court appel réel), Whisper, ffmpeg, SMTP (connexion sans envoi), ports 3000/5173.
// Code de sortie : 0 si aucun problème bloquant, 1 sinon (utilisé par les scripts de démarrage).
import 'dotenv/config'; // en premier : gemini.js et db.js lisent l'environnement à l'import
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/config/db.js';
import { generateWithFallback, embedText, EMBED_DIMENSIONS } from '../src/config/gemini.js';
import { checkSecurityConfig } from '../src/config/security.js';
import { commandWorks } from '../src/services/whisper.service.js';
import { createTransport } from '../src/services/notification.service.js';
import { buildChecks, runChecks, formatReport, hasErrors } from '../src/services/verification.service.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const portBusy = (port) => new Promise((resolve) => {
  const socket = net.connect({ host: 'localhost', port });
  const done = (busy) => { socket.destroy(); resolve(busy); };
  socket.setTimeout(2000, () => done(false));
  socket.once('connect', () => done(true));
  socket.once('error', () => done(false));
});

const fetchText = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return await res.text();
  } catch {
    return null;
  }
};

const deps = {
  env: process.env,
  securityProblems: () => (fs.existsSync(path.join(backendDir, '.env'))
    ? checkSecurityConfig()
    : ['Projet/Backend/.env introuvable : relancez le script de démarrage (il le crée depuis .env.example).']),
  query: (sql) => pool.query(sql),
  migrationFiles: () => fs.readdirSync(path.join(backendDir, 'database', 'migrations'))
    .filter((f) => f.endsWith('.sql')).sort(),
  generate: generateWithFallback,
  embed: (text) => embedText(text, 'RETRIEVAL_QUERY'),
  embedDimensions: EMBED_DIMENSIONS,
  commandWorks,
  smtpVerify: () => createTransport().verify(),
  portBusy,
  fetchText,
};

console.log('\nVeridian — vérification de l\'installation\n');
const results = await runChecks(buildChecks(deps, {
  skipAi: args.includes('--sans-ia'),
  skipWhisper: args.includes('--sans-whisper'),
}));
console.log(`\n${formatReport(results)}\n`);
await pool.end().catch(() => {});
process.exit(hasErrors(results) ? 1 : 0);
