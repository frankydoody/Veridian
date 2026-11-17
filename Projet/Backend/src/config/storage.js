// src/config/storage.js
// Dossier des fichiers audio envoyés (hors du code public, ignoré par Git : règle « uploads/»).
// Un seul endroit le définit : le middleware d'envoi l'utilise pour écrire, la route audio
// pour relire.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Par défaut : Projet/uploads (même emplacement qu'avant le bloc 14)
export const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || '../../../uploads');

export const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

const AUDIO_TYPES = {
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
};

export const audioContentType = (fileName) =>
  AUDIO_TYPES[path.extname(fileName).toLowerCase()] || 'application/octet-stream';

/**
 * Chemin absolu d'un fichier audio enregistré, ou null s'il est invalide ou absent.
 * Seul le NOM du fichier est gardé en base (meetings.audio_path) : on refuse tout ce qui
 * pourrait sortir du dossier (« ../ », chemin absolu), même si la base était modifiée.
 */
export const resolveAudioPath = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return null;
  if (path.basename(fileName) !== fileName) return null;
  const fullPath = path.resolve(UPLOAD_DIR, fileName);
  if (!fullPath.startsWith(UPLOAD_DIR + path.sep)) return null;
  return fs.existsSync(fullPath) ? fullPath : null;
};
