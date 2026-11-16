// src/services/whisper.service.js
// Transcription locale avec Whisper (ligne de commande `whisper`, paquet pip openai-whisper).
// Bloc 20 : appelé en ARRIÈRE-PLAN (plus jamais pendant une requête HTTP), avec :
//   - vérification de ffmpeg avant de lancer Whisper (sinon erreur obscure) ;
//   - délai maximal configurable (WHISPER_TIMEOUT_MIN, 30 min par défaut) ;
//   - messages d'erreur actionnables, en français ;
//   - nettoyage du fichier JSON temporaire dans tous les cas.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const INSTALL_HINT = {
  ffmpeg: 'Installez-le (Windows : winget install Gyan.FFmpeg ; Ubuntu : sudo apt install ffmpeg), '
    + 'ouvrez un NOUVEAU terminal, puis redémarrez le backend.',
  whisper: 'Installez-le (pip install openai-whisper) ou relancez le script de démarrage, '
    + 'ouvrez un NOUVEAU terminal, puis redémarrez le backend. '
    + 'Vous pouvez aussi indiquer son chemin complet dans WHISPER_COMMAND (.env).',
};

// Lance une commande et renvoie { code, stderr }. Rejette si la commande est introuvable.
const run = (command, args, { timeoutMs } = {}) => new Promise((resolve, reject) => {
  let proc;
  try {
    proc = spawn(command, args, { windowsHide: true });
  } catch (err) {
    reject(err);
    return;
  }
  let stderr = '';
  let timedOut = false;
  const timer = timeoutMs
    ? setTimeout(() => { timedOut = true; proc.kill(); }, timeoutMs)
    : null;

  proc.stdout?.on('data', () => {}); // vider le tampon (sinon le processus peut se bloquer)
  proc.stderr?.on('data', (data) => {
    stderr += data.toString();
    if (stderr.length > 20000) stderr = stderr.slice(-20000); // garder la fin seulement
  });
  proc.on('error', (err) => { if (timer) clearTimeout(timer); reject(err); });
  proc.on('close', (code) => {
    if (timer) clearTimeout(timer);
    resolve({ code, stderr, timedOut });
  });
});

// Dernière ligne utile de la sortie d'erreur (souvent la vraie cause)
const lastLine = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || '';

let ffmpegChecked = false;
export const checkFfmpeg = async () => {
  if (ffmpegChecked) return;
  try {
    const { code } = await run(process.env.FFMPEG_COMMAND || 'ffmpeg', ['-version'], { timeoutMs: 15000 });
    if (code !== 0) throw new Error(`code ${code}`);
    ffmpegChecked = true;
  } catch {
    throw new Error(`ffmpeg est introuvable : Whisper en a besoin pour lire l'audio. ${INSTALL_HINT.ffmpeg}`);
  }
};

// Uniquement pour les tests : refaire la vérification de ffmpeg
export const resetFfmpegCheck = () => { ffmpegChecked = false; };

/**
 * Transcrit un fichier audio. Renvoie le texte (éventuellement vide si aucune parole).
 * @param audioPath chemin du fichier audio (le fichier n'est PAS supprimé : il est conservé)
 */
export const transcribeAudio = async (audioPath) => {
  await checkFfmpeg();

  const outputDir = path.dirname(audioPath);
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const model = process.env.WHISPER_MODEL || 'small';
  const language = process.env.WHISPER_LANGUAGE || 'fr';
  const timeoutMin = Number(process.env.WHISPER_TIMEOUT_MIN) > 0 ? Number(process.env.WHISPER_TIMEOUT_MIN) : 30;

  const args = [
    audioPath,
    '--model', model,
    '--language', language,
    '--output_format', 'json',
    '--output_dir', outputDir,
    '--device', 'cpu',
    '--fp16', 'False',
  ];

  try {
    let result;
    try {
      result = await run(process.env.WHISPER_COMMAND || 'whisper', args, { timeoutMs: timeoutMin * 60 * 1000 });
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error(`Whisper est introuvable. ${INSTALL_HINT.whisper}`);
      throw new Error(`Impossible de lancer Whisper : ${err.message}`);
    }

    if (result.timedOut) {
      throw new Error(`La transcription a dépassé ${timeoutMin} minutes et a été arrêtée. `
        + 'Augmentez WHISPER_TIMEOUT_MIN dans .env ou choisissez un modèle plus rapide (WHISPER_MODEL=base).');
    }
    if (result.code !== 0) {
      const cause = lastLine(result.stderr);
      throw new Error(`Whisper a échoué (code ${result.code})${cause ? ` : ${cause}` : ''}`);
    }
    if (!fs.existsSync(jsonPath)) {
      throw new Error('Whisper n\'a produit aucun résultat (fichier JSON absent).');
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return String(data.text ?? '').trim();
  } finally {
    // Nettoyage dans tous les cas (succès, erreur, délai dépassé)
    fs.rmSync(jsonPath, { force: true });
  }
};
