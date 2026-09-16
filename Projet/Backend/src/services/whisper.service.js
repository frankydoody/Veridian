import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export const transcribeAudio = async (audioPath) => {
  const outputDir = path.dirname(audioPath);
  const model = process.env.WHISPER_MODEL || 'small';
  const language = process.env.WHISPER_LANGUAGE || 'fr';

  await new Promise((resolve, reject) => {
    const args = [
      audioPath,
      '--model', model,
      '--language', language,
      '--output_format', 'json',
      '--output_dir', outputDir,
      '--device', 'cpu',
      '--fp16', 'False',
    ];

    const proc = spawn('whisper', args);

    proc.stdout.on('data', (data) => {
      console.log('[Whisper stdout]', data.toString());
    });

    proc.stderr.on('data', (data) => {
      console.log('[Whisper stderr]', data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Whisper a terminé avec le code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Impossible de lancer Whisper: ${err.message}`));
    });
  });

  const baseName = path.basename(audioPath, path.extname(audioPath));
  const jsonPath = path.join(outputDir, `${baseName}.json`);

  if (!fs.existsSync(jsonPath)) {
    throw new Error('Whisper n\'a pas produit de fichier JSON');
  }

  const result = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  fs.unlinkSync(jsonPath);

  return result.text.trim();
};