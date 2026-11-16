// src/middlewares/upload.middleware.js
// Réception d'un fichier audio (champ « audio » d'un formulaire multipart).
// Bloc 20 :
//   - types acceptés : webm, ogg, mp4/m4a, mpeg (mp3), wav (et leurs variantes de nom) ;
//   - l'extension enregistrée vient du TYPE vérifié, jamais du nom choisi par l'utilisateur ;
//   - nom de fichier aléatoire, dossier hors du code public (src/config/storage.js) ;
//   - taille maximale MAX_AUDIO_MB (200 Mo par défaut) ;
//   - erreurs claires : 413 (trop gros), 415 (type refusé) au lieu d'une erreur 500.
import crypto from 'crypto';
import multer from 'multer';
import { UPLOAD_DIR, ensureUploadDir } from '../config/storage.js';

ensureUploadDir();

// Type MIME (sans paramètres) → extension enregistrée
const AUDIO_EXTENSIONS = {
  'audio/webm': '.webm',
  'video/webm': '.webm',      // certains navigateurs étiquettent ainsi un enregistrement audio seul
  'audio/ogg': '.ogg',
  'application/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/m4a': '.m4a',
  'audio/aac': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/vnd.wave': '.wav',
};

// « audio/webm;codecs=opus » → « audio/webm »
export const baseMimeType = (mimetype) => String(mimetype ?? '').split(';')[0].trim().toLowerCase();

export const audioExtensionFor = (mimetype) => AUDIO_EXTENSIONS[baseMimeType(mimetype)] ?? null;

export const maxAudioBytes = () => {
  const mb = Number(process.env.MAX_AUDIO_MB);
  return Math.floor((Number.isFinite(mb) && mb > 0 ? mb : 200) * 1024 * 1024); // octets entiers
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Nom imprévisible : on ne peut pas deviner l'adresse d'un autre enregistrement
  filename: (req, file, cb) => {
    cb(null, `audio_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${audioExtensionFor(file.mimetype)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (audioExtensionFor(file.mimetype)) return cb(null, true);
  const error = new Error(`Format audio non pris en charge (${baseMimeType(file.mimetype) || 'inconnu'}). `
    + 'Formats acceptés : webm, ogg, mp3, wav, m4a.');
  error.status = 415;
  return cb(error);
};

const multerUpload = () => multer({
  storage,
  fileFilter,
  limits: { fileSize: maxAudioBytes(), files: 1 },
}).single('audio');

// Traduit les erreurs de multer en réponses claires (sinon : 500 « Erreur interne »)
export const uploadAudio = (req, res, next) => {
  multerUpload()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: `Fichier trop volumineux : ${Math.round(maxAudioBytes() / 1024 / 1024)} Mo au maximum (MAX_AUDIO_MB).`,
      });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Envoi refusé : ${err.message}` });
    }
    return res.status(err.status || 400).json({ message: err.message });
  });
};
