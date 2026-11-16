import multer from 'multer';
import path from 'path';
import { UPLOAD_DIR, ensureUploadDir } from '../config/storage.js';

ensureUploadDir();
const uploadDir = UPLOAD_DIR;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}_${req.user.id}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'audio/webm',
    'audio/mp4',
    'audio/wav',
    'audio/mpeg',
    'audio/ogg',
    'audio/x-m4a',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Format audio non supporté : ${file.mimetype}`), false);
  }
};

export const uploadAudio = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024,
  },
}).single('audio');